import { Job, Queue, QueueEvents } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();
import type { ExecutionJob, JobStatus, ExecutionResult, AddJobData } from '../types/index';
import { redisConfig } from '../config/redis.config';

export const executionQueue = new Queue('execution', { connection: redisConfig });
export const sessionQueue = new Queue('session', { connection: redisConfig });

export const addExecutionJobs = async (jobData: AddJobData): Promise<Job> => {
    //d efault job options backoff and   attempts
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

export const addSessionJobs = async(jobData: AddJobData): Promise<Job> => {
    const job = await sessionQueue.add('runSession', jobData, {
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
}
