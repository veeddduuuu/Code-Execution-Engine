import { Job, tryCatch, Worker } from "bullmq";
import dotenv from "dotenv";
import Docker from "dockerode";
dotenv.config();
import type { ExecutionJob, JobStatus, ExecutionResult, AddExecutionJobData } from '../../../../packages/types/index';
import { redisConfig, createRedisClient } from '../../../../packages/config/redis.config';
import fs from "fs";
import path from "path";
import { PassThrough } from "stream";
import { pool } from "../../../../packages/db/pool";

const redis = createRedisClient();
const scratchDir = process.env.SCRATCH_DIR || "/tmp";
const activeExecutions = new Map<string, Docker.Container>();
const cancelledJobs = new Map<string, boolean>();

const docker = new Docker();

const cancelSubscriber = createRedisClient();

async function initCancelSubscriber() {
    await cancelSubscriber.psubscribe(`job:*:control`);
}
initCancelSubscriber();


cancelSubscriber.on('pmessage', async (pattern, channel, message) => {
    const jobId = channel.split(':')[1];
    const { type } = JSON.parse(message);
    if (type === 'CANCEL') {
        cancelledJobs.set(jobId, true);
        const container = activeExecutions.get(jobId);
        if (container) {
            try {
                await container.kill();
            } catch (dockererr) {
                console.error(`Failed to kill container for cancelled job ${jobId}:`, dockererr);
            }
            redis.publish(`job:${jobId}`, JSON.stringify({
                type: 'CANCELLED',
                message: 'Job was cancelled by user',
                ts: Date.now()
            }));
            // await pool.query(`UPDATE jobs SET status = 'cancelled' WHERE id = $1`, [jobId]);
            console.log(`Job ${jobId} was cancelled and container was killed`);
        }
        else return;
    }
});

const worker = new Worker('execution', async (job: Job) => {
    console.log("worker hit")
    console.log(job.data);
    console.log(job.data.code);
    const jobId = job.data.jobId;

    const currentJob = await pool.query('SELECT status FROM jobs WHERE id = $1', [jobId]);
    if (currentJob.rows[0]?.status === 'cancelled') {
        throw new Error("JOB_CANCELLED");
    }

    const updateQuery = 'UPDATE jobs SET status = $1, started_at = $2 WHERE id = $3 AND status <> $4 RETURNING id';
    const startedJob = await pool.query(updateQuery, ['running', new Date(), jobId, 'cancelled']);
    if (startedJob.rowCount === 0) {
        const latestJob = await pool.query('SELECT status FROM jobs WHERE id = $1', [jobId]);
        if (latestJob.rows[0]?.status === 'cancelled') {
            throw new Error("JOB_CANCELLED");
        }
        throw new Error(`Failed to start job ${jobId}`);
    }

    let container: Docker.Container | undefined = undefined;
    let timeoutHandle: NodeJS.Timeout | undefined = undefined;
    const hostFilePath = path.join(scratchDir, `${jobId}.js`);
    try {
        fs.writeFileSync(hostFilePath, job.data.code, { encoding: 'utf-8', mode: 0o644 });
        if (cancelledJobs.has(jobId)) {
            throw new Error("JOB_CANCELLED");
        }
        container = await docker.createContainer({
            Image: "node:20-alpine",
            Cmd: ["node", "/app/code.js"],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            HostConfig: {
                Memory: 1024 * 1024 * 128,
                NanoCpus: 500_000_000,
                NetworkMode: "none",
                AutoRemove: false,
                Binds: [`${hostFilePath}:/app/code.js:ro`],
            }
        });

        if (cancelledJobs.has(jobId)) {
            throw new Error("JOB_CANCELLED");
        }

        activeExecutions.set(jobId, container);

        if (cancelledJobs.has(jobId)) {
            try {
                await container.kill();
            } catch (dockererr) {
                console.error(`Failed to kill container for cancelled job ${jobId}:`, dockererr);
            }
            throw new Error("JOB_CANCELLED");
        }

        const muxedStream = await container.attach({ stream: true, stdout: true, stderr: true });

        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();

        let finalLogs = "";

        container.modem.demuxStream(muxedStream, stdoutStream, stderrStream);

        stdoutStream.on("data", async (chunk) => {
            console.log(`Container stdout: ${chunk.toString()}`);
            finalLogs += chunk.toString();
            const logEntry = {
                type: 'LOG',
                stream: 'stdout',
                data: chunk.toString(),
                ts: Date.now()
            };
            await redis.publish(`job:${jobId}`, JSON.stringify(logEntry));
            await redis.lpush(`job:${jobId}:logs`, JSON.stringify(logEntry));
            await redis.ltrim(`job:${jobId}:logs`, 0, 99);
            await redis.expire(`job:${jobId}:logs`, 60 * 60 * 24);
        });

        stderrStream.on("data", async (chunk) => {
            console.error(`Container stderr: ${chunk.toString()}`);
            finalLogs += chunk.toString();
            const logEntry = {
                type: 'LOG',
                stream: 'stderr',
                data: chunk.toString(),
                ts: Date.now()
            }

            await redis.publish(`job:${jobId}`, JSON.stringify(logEntry));
            await redis.lpush(`job:${jobId}:logs`, JSON.stringify(logEntry));
            await redis.ltrim(`job:${jobId}:logs`, 0, 99);
            await redis.expire(`job:${jobId}:logs`, 60 * 60 * 24);
        });

        if (!container) {
            throw new Error("Failed to create container");
        }

        if (cancelledJobs.has(jobId)) {
            try {
                await container.kill();
            } catch { }
            throw new Error("JOB_CANCELLED");
        }

        await container.start();
        const waitPromise = container.wait().finally(() => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        })
        const timerPromise = new Promise<never>((_, reject) => {
            const timeout = parseInt(process.env.EXECUTION_TIMEOUT_MS || '30000', 10);
            timeoutHandle = setTimeout(async () => {
                try {
                    await container?.stop({ t: 0 });
                } catch { }
                try {
                    await container?.kill();
                } catch { }
                finalLogs += "Execution timed out and container was stopped\n";
                console.error("Execution timed out and container was stopped");
                reject(new Error("Execution timed out"));
            }, timeout);
        });

        const result = await Promise.race([waitPromise, timerPromise]);

        if (cancelledJobs.has(jobId)) {
            throw new Error("JOB_CANCELLED");
        }

        const executionResult: ExecutionResult = {
            success: result.StatusCode === 0,
            exitCode: result.StatusCode,
            ranAt: Date.now(),
            logs: finalLogs,
        };

        if (!executionResult.success) {
            throw new Error(`Execution failed with exit code ${executionResult.exitCode}`);
        }

        if (executionResult.exitCode === 137) {
            executionResult.logs += "Container was killed due to timeout\n";
            console.error("Container was killed due to timeout");
        }

        await redis.publish(`job:${jobId}`, JSON.stringify({
            type: 'DONE',
            success: executionResult.success,
            exitCode: executionResult.exitCode,
            ts: Date.now()
        }));

        return executionResult;

    } catch (error) {
        console.error("Execution worker error:", error);
        throw error;

    } finally {

        activeExecutions.delete(jobId);

        if (container) {
            try {
                await container.remove({ force: true });
                console.log("Container cleaned up");
            }
            catch (cleanupError) {
                console.error("Failed to cleanup container", cleanupError);
            }
        }

        try {
            if (fs.existsSync(hostFilePath)) {
                fs.unlinkSync(hostFilePath);
                console.log("Host file cleaned up");
            }
        } catch (cleanupError) {
            console.error("Failed to clean up host file:", cleanupError);
        }
    }
},
    {
        connection: redisConfig,
        concurrency: 3
    });

worker.on('completed', async (job: Job, result: ExecutionResult) => {
    const jobId = job.data.jobId;
    console.log(`Job ${jobId} completed with result: ${JSON.stringify(result)}`);
    const updateResultQuery = `UPDATE jobs
        SET status = $1, output = $2, completed_at = $3, exit_code = $4
        WHERE id = $5 AND status <> 'cancelled'`;
    await pool.query(updateResultQuery, ['completed', result.logs, new Date(), result.exitCode, jobId]);
});

worker.on('failed', async (job: Job | undefined, err: Error) => {
    if (!job) return;
    const jobId = job.data.jobId;
    if (cancelledJobs.has(jobId) || err.message === "JOB_CANCELLED") {
        const updateFailedQuery = 'UPDATE jobs SET status = $1, error_message = $2, completed_at = $3 WHERE id = $4';
        await pool.query(updateFailedQuery, ['cancelled', 'Job was cancelled', new Date(), jobId]);
        cancelledJobs.delete(jobId);
        console.log(`Job ${jobId} was cancelled and marked as such in the database`);
    }
    else {
        const maxAttempts = job.opts.attempts ?? 1;
        const status = job.attemptsMade >= maxAttempts ? 'dead' as JobStatus : 'failed' as JobStatus;
        const updateFailedQuery = 'UPDATE jobs SET status = $1, error_message = $2, completed_at = $3 WHERE id = $4';
        await pool.query(updateFailedQuery, [status, err.message, new Date(), jobId])
    }
});

export default worker;
