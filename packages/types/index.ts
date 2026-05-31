import { Job } from 'bullmq';
import { WebSocket } from 'ws';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dead';

export type ExecutionResult = {
    success: boolean;
    exitCode: number;
    ranAt: number;
    logs: string;
};

export interface ExecutionJob extends Job {
    jobId: string;
    status: JobStatus;
    result: ExecutionResult | null;
    error?: string;
}

export interface ExecutionJobResponse {
    jobId: string;
    status: JobStatus;
    result: ExecutionResult | null;
    error?: string;
};

export type AddExecutionJobData = {
    code: string;
    language: 'javascript';
}

export interface ExtendedWebSocket extends WebSocket {
    isAlive: boolean
}

export type AddSessionJobData = {
    sessionId: string;
    command: string;
}

export interface Session {
    sessionId: string;
    containerId: string;
    status: 'created' | 'running' | 'stopped';
    createdAt?: number;
}