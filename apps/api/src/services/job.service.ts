import { Job } from 'bullmq/dist/esm/classes/job';
import { executionQueue } from '../../../../packages/queues/index';
import type { ExecutionJobResponse, ExecutionResult, JobStatus } from '../../../../packages/types/index';
 
const jobStatusMap = (state : string | undefined, attemptsMade: number, maxAttempts: number) => {
    let status : JobStatus;
    switch(state){
        case 'waiting':
        case 'delayed':
            status = 'pending';
            break;
        case 'active':
            status = 'running';
            break;
        case 'completed':
            status = 'completed';
            break;
        case 'failed':
            status = attemptsMade >= maxAttempts ? 'dead' : 'failed';
            break;
        default:
            status = 'pending';
    }
    return status;
} 

export const getAllJobs = async () => {
    const jobs  = await executionQueue.getJobs();
    const result : ExecutionJobResponse[] = [];
    for (const job of jobs) {
        const state = await job.getState();
        const status = jobStatusMap(state, job.attemptsMade, job.opts.attempts??1);
        if(!job.id){
            continue;
        }
        result.push({
            jobId: job.id,
            status,
            result: (job.returnvalue as ExecutionResult) || null,
            error: job.failedReason || undefined,
        });
    }
    return result;
}

export const getExecutionJobById = async (jobId: string) => {
    const job = await executionQueue.getJob(jobId);
    const state = await job?.getState();

    if (!job) {
        return null;
    }
    const status = jobStatusMap(state, job.attemptsMade, job.opts.attempts ?? 1);

    return {
        jobId,
        status,
        result: (job.returnvalue as ExecutionResult) || null,
        error: job.failedReason || undefined,
    };
};