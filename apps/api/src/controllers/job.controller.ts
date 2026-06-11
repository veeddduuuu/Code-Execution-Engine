import { Request, Response } from 'express';
import {
    getExecutionJobById,
    getAllJobs,
    cancelExecutionJob,
    getDeadLetterJobs,
    replayDeadLetterJob
} from '../services/job.service';

type JobParams = {
    id: string;
}

export const getJobs = async (req: Request, res: Response) => {
    const jobs = await getAllJobs();
    return res.status(200).json(jobs);
}

export const getJobStatus = async (req: Request<JobParams>, res: Response) => {
    const jobId = req.params.id;

    if (!jobId) {
        return res.status(400).json({ message: 'Job ID is required' });
    }

    try {
        const job = await getExecutionJobById(jobId);

        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        const result = job.result;
        const error = job.error;
        return res.status(200).json({
            jobId,
            status: job.status,
            result: result || null,
            error: error || null,
            code: job.code,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt
        });
    } catch (error) {
        return res.status(404).json({ message: 'Job not found' });
    }
}

export const getDlq = async (req: Request, res: Response) => {
    try {
        const deadJobs = await getDeadLetterJobs();
        return res.status(200).json(deadJobs);
    } catch (error) {
        console.error('Error fetching DLQ:', error);
        return res.status(500).json({ message: 'Failed to fetch DLQ' });
    }
}

export const replayDlq = async (req: Request<JobParams>, res: Response) => {
    const { id: jobId } = req.params;
    if (!jobId) {
        return res.status(400).json({ message: 'Job ID is required' });
    }
    try {
        const result = await replayDeadLetterJob(jobId);
        return res.status(202).json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('Error replaying DLQ job:', error);
        const status = error.message === 'Dead job not found' ? 404 : 500;
        return res.status(status).json({ message: error.message || 'Failed to replay DLQ job' });
    }
}

export const cancelJob = async (req: Request<JobParams>, res: Response) => {
    const { id: jobId } = req.params;
    if (!jobId) {
        return res.status(400).json({ message: 'Job ID is required' });
    }
    try {
        const result = await cancelExecutionJob(jobId);
        if(result) {
            return res.status(200).json({
                success: true,
                ...result
            });
        }
        else {
            return res.status(404).json({
                success: false,
                message: 'Job cannot be cancelled. It may have already completed or does not exist.'
            });
        }
    } catch (error) {
        console.error('Error cancelling job:', error);
        return res.status(500).json({ message: 'Failed to cancel job' });
    }
}