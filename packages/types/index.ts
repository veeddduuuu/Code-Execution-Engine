export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ExecutionJob = {
    jobId: string;
    status: JobStatus;
    result: string | null;
    error?: string;
};
