import { Job, Worker } from "bullmq";
import dotenv from "dotenv";
import Docker from "dockerode";
dotenv.config();
import type { ExecutionJob, JobStatus, ExecutionResult, AddJobData } from '../../../../packages/types/index.ts';
import {connection} from "../../../../packages/config/redis.config.ts";

function demuxDockerLogs(buffer: Buffer): string{
    let logs = "";
    for(let i = 0; i < buffer.length;){
        const header = buffer.slice(i, i + 8);
        const streamType = header.readUInt8(0);
        const payloadLength = header.readUInt32BE(4);
        const payload = buffer.slice(i + 8, i + 8 + payloadLength);
        logs += payload.toString("utf-8");
        i += 8 + payloadLength;
    }
    return logs;
}

const docker = new Docker();
const worker = new Worker('execution', async (job: Job) => {
    console.log("worker hit")
    console.log(job.data);
    console.log(job.data.code);
    let container: Docker.Container | undefined = undefined;
    let timeoutHandle: NodeJS.Timeout | undefined = undefined;
    try {
        container = await docker.createContainer({
            Image: "node:20-alpine",
            Cmd: ["node", "-e", job.data.code],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            HostConfig: {
                Memory: 1024 * 1024 * 64,
                NanoCpus: 500_000_000,
                NetworkMode: "none",
                AutoRemove: false,
            }
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
            const timeout = parseInt(process.env.EXECUTION_TIMEOUT_MS || '5000', 10);
            timeoutHandle = setTimeout(async () => {
                try {
                    await container?.stop({ t: 0 });
                } catch {}

                try {
                    await container?.kill();
                } catch {}
                console.error("Execution timed out and container was stopped");
                reject(new Error("Execution timed out"));
            }, timeout);
        });
        const result = await Promise.race([waitPromise, timerPromise]);

        const logsBuffer = (await container.logs({ stdout: true, stderr: true })) as unknown as Buffer; 
        const logs = demuxDockerLogs(logsBuffer);
        console.log(logs);
        const executionResult: ExecutionResult = {
            success: result.StatusCode === 0,
            exitCode: result.StatusCode,
            ranAt: Date.now(),
            logs,
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
                console.error("Failed to cleanup container:", cleanupError); 
            } 
        }
    }
}, 
{
    connection,
    concurrency: 3
});

worker.on('completed', (job: Job, result: ExecutionResult) => {
    console.log(`Job ${job.id} completed with result: ${JSON.stringify(result)}`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`Job ${job?.id ?? 'unknown'} failed with error: ${err.message}`);
});

export default worker;
