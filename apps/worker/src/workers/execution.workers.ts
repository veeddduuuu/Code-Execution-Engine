import { Job, Worker } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const worker = new Worker('execution', async (job: Job) => {
    console.log(job.data.code);
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
