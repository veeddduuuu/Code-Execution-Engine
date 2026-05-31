import { Worker } from 'bullmq';
import { redis, redisConfig } from '../../../../packages/config/redis.config';
import Docker from "dockerode";
import { PassThrough } from 'node:stream';

const docker = new Docker();

export const sessionsWorker = new Worker('session', async (job) => {
    const sessionId = job.data.sessionId;
    const containerId = await redis.hget(`session:${sessionId}`, 'containerId');
    if (!containerId) {
        throw new Error(`No container found for session ${sessionId}`);
    }
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
        Cmd: ["sh", "-c", job.data.command],
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
    });

    const muxedStream = await exec.start({ hijack: true, stdin: false });
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    let finalLogs = "";

    container.modem.demuxStream(muxedStream, stdoutStream, stderrStream);

    muxedStream.on('end', () => { stdoutStream.end(); stderrStream.end(); });

    stdoutStream.on("data", async (chunk) => {
        console.log(`Container stdout: ${chunk.toString()}`);
        finalLogs += chunk.toString();
        const logEntry = {
            type: 'LOG',
            stream: 'stdout',
            data: chunk.toString(),
            ts: Date.now()
        };
        await redis.publish(`job:${job.id}`, JSON.stringify(logEntry));
        console.log(`Publishing log entry to channel job:${job.id}`);
        await redis.lpush(`job:${job.id}:logs`, JSON.stringify(logEntry));
        console.log(`Pushed log entry to list job:${job.id}:logs`);
        await redis.ltrim(`job:${job.id}:logs`, 0, 99);
        await redis.expire(`job:${job.id}:logs`, 60 * 60 * 24);
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
        console.log(`Publishing log entry to channel job:${job.id}`);
        await redis.publish(`job:${job.id}`, JSON.stringify(logEntry));
        await redis.lpush(`job:${job.id}:logs`, JSON.stringify(logEntry));
        await redis.ltrim(`job:${job.id}:logs`, 0, 99);
        await redis.expire(`job:${job.id}:logs`, 60 * 60 * 24);
    });


    await Promise.all([
        new Promise<void>((resolve, reject) => {
            stdoutStream.on('end', resolve);
            stdoutStream.on('error', reject);
        }),
        new Promise<void>((resolve, reject) => {
            stderrStream.on('end', resolve);
            stderrStream.on('error', reject);
        })
    ])

    const result = await exec.inspect();
    const exitCode = result.ExitCode;
    const status = exitCode === 0 ? 'completed' : 'failed';
    const executionResult = {
        success: status === 'completed',
        exitCode: exitCode,
        ranAt: Date.now(),
        logs: finalLogs,
    };
    console.log(`Execution result for job ${job.id}:`, executionResult);

    await redis.publish(`job:${job.id}`, JSON.stringify({
        type: 'DONE',
        exitCode: exitCode,
        logs: finalLogs,
    }));
    console.log(`Published DONE message to channel job:${job.id}`);
    return executionResult;
},
    {
        connection: redisConfig,
        concurrency: 3,
    });
