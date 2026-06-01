import { Job, Queue } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();
import type { AddExecutionJobData } from '../types/index';
import { redisConfig } from '../config/redis.config';

export const executionQueue = new Queue('execution', { connection: redisConfig });

export const addExecutionJobs = async (jobData: AddExecutionJobData): Promise<Job> => {
    const job = await executionQueue.add('executeCode', jobData, {
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        attempts: 3
    });
    if (job.id === undefined || job.id === null) {
        throw new Error('BullMQ did not return a job id');
    }
    return job;
};
