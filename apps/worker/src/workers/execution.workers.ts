import { Job, Worker } from "bullmq";
import dotenv from "dotenv";
import Docker from "dockerode";
dotenv.config();

const docker = new Docker();

const worker = new Worker('execution', async (job: Job) => {
    console.log("worker hit")
    console.log(job.data);
    console.log(job.data.code);
    let container: Docker.Container | undefined = undefined;
    try {
        container = await docker.createContainer({
            Image: "node:20-alpine",
            Cmd: ["node", "-e", job.data.code],
            AttachStdout: true,
            AttachStderr: true,
            // Tty: false,
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
        const waitContainer = await container.wait();
        const logsBuffer = (await container.logs({ stdout: true, stderr: true })) as unknown as Buffer; 
        const logs = logsBuffer.toString("utf-8");
        console.log(logsBuffer);
        return {
            success: waitContainer.StatusCode === 0,
            exitCode: waitContainer.StatusCode,
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
