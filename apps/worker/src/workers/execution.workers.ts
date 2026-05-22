import { Job, tryCatch, Worker } from "bullmq";
import dotenv from "dotenv";
import Docker from "dockerode";
dotenv.config();
import type { ExecutionJob, JobStatus, ExecutionResult, AddJobData } from '../../../../packages/types/index.ts';
import {redisConfig, createRedisClient} from '../../../../packages/config/redis.config.ts';
import fs from "fs";
import path from "path";
import { PassThrough } from "stream";

const redis = createRedisClient();
const scratchDir = path.join(process.env.HOME || '/home/vedant', '.cee-scratch');
if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
}

const docker = new Docker();
const worker = new Worker('execution', async (job: Job) => {
    console.log("worker hit")
    console.log(job.data);
    console.log(job.data.code);
    let container: Docker.Container | undefined = undefined;
    let timeoutHandle: NodeJS.Timeout | undefined = undefined;
    const hostFilePath = path.join('/tmp', `${job.id}.js`);
    try {
        fs.writeFileSync(hostFilePath, job.data.code, { encoding: 'utf-8', mode: 0o644 });
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
                Binds : [`${hostFilePath}:/app/code.js:ro`],
            }
        });

        const muxedStream = await container.attach({ stream: true, stdout: true, stderr: true });
    
        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();
        
        let finalLogs = "";

        container.modem.demuxStream(muxedStream, stdoutStream, stderrStream);

        stdoutStream.on("data", (chunk) => {
            console.log(`Container stdout: ${chunk.toString()}`);
            finalLogs += chunk.toString();
            redis.publish(`job:${job.id}`, JSON.stringify({ type: 'stdout', message: chunk.toString() }));
        });
        stderrStream.on("data", (chunk) => {
            console.error(`Container stderr: ${chunk.toString()}`);
            finalLogs += chunk.toString();
            redis.publish(`job:${job.id}`, JSON.stringify({ type: 'stderr', message: chunk.toString() }));
        });

        if (!container) {
            throw new Error("Failed to create container");
        }

        await container.start();
        const waitPromise = container.wait().finally(()=>{
            if(timeoutHandle){
                clearTimeout(timeoutHandle);
            }
        })
        const timerPromise = new Promise<never>((_,reject) => {
            const timeout = parseInt(process.env.EXECUTION_TIMEOUT_MS || '30000', 10);
            timeoutHandle = setTimeout(async () => {
                try {
                    await container?.stop({ t: 0 });
                } catch {}
                try {
                    await container?.kill();
                } catch {}
                finalLogs += "Execution timed out and container was stopped\n";
                console.error("Execution timed out and container was stopped");
                reject(new Error("Execution timed out"));
            }, timeout);
        });

        const result = await Promise.race([waitPromise, timerPromise]);

        const executionResult: ExecutionResult = {
            success: result.StatusCode === 0,
            exitCode: result.StatusCode,
            ranAt: Date.now(),
            logs: finalLogs,
        };

        if(!executionResult.success){
            throw new Error(`Execution failed with exit code ${executionResult.exitCode}`);    
        }

        return executionResult;

    } catch (error) { 

        console.error("Execution worker error:", error);
        throw error;

    } finally {

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
            if(fs.existsSync(hostFilePath)){
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

worker.on('completed', (job: Job, result: ExecutionResult) => {
    console.log(`Job ${job.id} completed with result: ${JSON.stringify(result)}`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`Job ${job?.id ?? 'unknown'} failed with error: ${err.message}`);
});

export default worker;
