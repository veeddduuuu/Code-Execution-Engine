import { Job, Queue, QueueEvents } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();
import type { SessionJobData, AddExecutionJobData } from '../types/index';
import { redisConfig } from '../config/redis.config';

export const executionQueue = new Queue('execution', { connection: redisConfig });
export const sessionQueue = new Queue('session', { connection: redisConfig });

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

export const addSessionJobs = async (jobData: SessionJobData): Promise<Job> => {
    const job = await sessionQueue.add('manageSession', jobData, {
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
