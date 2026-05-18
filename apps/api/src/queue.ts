import { Job, Queue, QueueEvents } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();
import type { ExecutionJob, JobStatus, ExecutionResult, AddJobData } from '../../../packages/types/index';

const connection = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null as null,
};

export const executionQueue = new Queue('execution', { connection });

export const addJobs = async (jobData: AddJobData): Promise<Job> => {
    const job = await executionQueue.add('executeCode', jobData);
    if (job.id === undefined || job.id === null) {
        throw new Error('BullMQ did not return a job id');
    }
    return job; 
};
