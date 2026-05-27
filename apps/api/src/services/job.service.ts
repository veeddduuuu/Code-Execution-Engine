import {executionQueue} from '../../../../packages/queues/index';
import type {ExecutionResult, JobStatus} from '../../../../packages/types/index';

export const getExecutionJobById = async (jobId: string) => {
    const job = await executionQueue.getJob(jobId);
    const state = await job?.getState();
    
    if (!job) {
        return null;
    }

    let status: JobStatus;
    switch (state) {
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
            status = 'failed';
            break;
        default:
            status = 'pending';
    }

    return {
        jobId,
        status,
        result: (job.returnvalue as ExecutionResult) || null,
        error: job.failedReason || null,
    };
};