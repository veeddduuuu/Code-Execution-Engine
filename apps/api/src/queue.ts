import { Job, Queue, QueueEvents } from 'bullmq';

const connection = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null as null,
};

export const executionQueue = new Queue('execution', { connection });

export const executionQueueEvents = new QueueEvents('execution', { connection });
executionQueueEvents.on('error', (err) => {
    console.error('QueueEvents error:', err);
});

type JobData = {
    code: string;
    language: string;
};

export const addJobs = async (jobData: JobData): Promise<Job> => {
    const job = await executionQueue.add('executeCode', { jobData });
    if (job.id === undefined || job.id === null) {
        throw new Error('BullMQ did not return a job id');
    }
    return job; 
};
