import { Job, Worker } from "bullmq";
import dotenv from "dotenv";
import Docker from "dockerode";
dotenv.config();

const docker = new Docker();
//TODO : Timer to kill container if it runs too long (e.g. 30 seconds) to prevent abuse and resource exhaustion. This can be done by setting a timeout when starting the container and forcefully stopping it if it exceeds the time limit.
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
            const timeout = parseInt(process.env.EXECUTION_TIMEOUT_MS || "5000", 10);
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
        const logs = logsBuffer.toString("utf-8");
        console.log(logsBuffer);
        return {
            success: result.StatusCode === 0,
            exitCode: result.StatusCode,
            ranAt: Date.now(),
            logs,
        }; 
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
    connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        maxRetriesPerRequest: null,
    },
});

worker.on('completed', (job: Job, result) => {
    console.log(`Job ${job.id} completed with result: ${result}`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`Job ${job?.id ?? 'unknown'} failed with error: ${err.message}`);
});

export default worker;
