import {WebSocket} from 'ws';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ExecutionResult = {
    success: boolean;
    exitCode: number;
    ranAt: number;
    logs: string;
};

export type ExecutionJob = {
    jobId: string;
    status: JobStatus;
    result: ExecutionResult | null;
    error?: string;
};

export type AddJobData = {
    code: string;
    language: 'javascript';
}

export interface ExtendedWebSocket extends WebSocket {
    isAlive : boolean
}