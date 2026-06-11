import { Job } from 'bullmq/dist/esm/classes/job';
import { executionQueue, addExecutionJobs } from '../../../../packages/queues/index';
import type { ExecutionJobResponse, ExecutionResult, JobStatus } from '../../../../packages/types/index';
import {pool} from '../../../../packages/db/pool';
import { createRedisClient } from '../../../../packages/config/redis.config';
import crypto from 'crypto';

export const getAllJobs = async () => {
    const getAllJobsQuery = 'SELECT id, status, output, error_message, created_at FROM jobs ORDER BY created_at DESC LIMIT 100';
    const { rows } = await pool.query(getAllJobsQuery);
   
    return rows.map(row => ({
        jobId: row.id,
        status : row.status,
        result: row.output || null,
        error: row.error_message || undefined,
        createdAt: row.created_at
    }));
}

export const getExecutionJobById = async (jobId: string) => {
    const job = await pool.query('SELECT id, status, output, error_message, code, created_at, started_at, completed_at FROM jobs WHERE id = $1', [jobId]);
    if(job.rows.length === 0) {
        throw new Error('Job not found');
    }
    return {
        jobId : job.rows[0].id,
        status : job.rows[0].status as JobStatus,
        result: job.rows[0].output || null,
        error: job.rows[0].error_message || undefined,
        code: job.rows[0].code,
        createdAt: job.rows[0].created_at,
        startedAt: job.rows[0].started_at,
        completedAt: job.rows[0].completed_at
    };
};

export const getDeadLetterJobs = async () => {
    const { rows } = await pool.query(
        "SELECT id, status, code, language, error_message, created_at FROM jobs WHERE status = 'dead' ORDER BY created_at DESC LIMIT 100"
    );
    return rows.map(row => ({
        jobId: row.id,
        status: row.status,
        code: row.code,
        language: row.language,
        error: row.error_message || undefined,
        createdAt: row.created_at
    }));
};

export const replayDeadLetterJob = async (jobId: string) => {
    const jobResult = await pool.query('SELECT code, language FROM jobs WHERE id = $1 AND status = $2', [jobId, 'dead']);
    if (jobResult.rows.length === 0) {
        throw new Error('Dead job not found');
    }

    const { code, language } = jobResult.rows[0];
    const newJobId = crypto.randomUUID();

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            'INSERT INTO jobs (id, code, language, status) VALUES ($1, $2, $3, $4)',
            [newJobId, code, language, 'pending']
        );
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error('Error starting transaction for DLQ replay:', error);
        throw new Error('Failed to write replay job to database');
    } finally {
        client.release();
    }

    try {
        await addExecutionJobs({
            jobId: newJobId,
            code,
            language: language as 'javascript'
        });
        return {
            jobId: newJobId,
            status: 'pending' as JobStatus
        };
    } catch (error) {
        console.error('Error enqueuing replayed job:', error);
        const updateFailedQuery = 'UPDATE jobs SET status = $1, error_message = $2, completed_at = $3, exit_code = $4 WHERE id = $5';
        await pool.query(updateFailedQuery, ['failed', String(error), new Date(), 1, newJobId]);
        throw new Error('Failed to enqueue replayed job');
    }
};

export const cancelExecutionJob = async (jobId: string)=>{
    const job = await pool.query(`SELECT id, status FROM jobs WHERE id = $1`, [jobId]);
    if(job.rows.length === 0) {
        return;
    }
    const bullmqJob = await executionQueue.getJob(job.rows[0].id);
    const status = job.rows[0].status;
    if(status === 'pending'){
        await bullmqJob?.remove();
        await pool.query(`UPDATE jobs SET status = 'cancelled' WHERE id = $1`, [jobId]);
        return { 
            jobId: jobId, 
            status: 'cancelled' as JobStatus,
            result: null,
            error: undefined
        };
    }
    else if(status === 'running'){
        const cancelledJob = await pool.query(
            `UPDATE jobs SET status = 'cancelled', error_message = 'Job cancellation requested' WHERE id = $1 AND status = 'running' RETURNING id`,
            [jobId]
        );
        if (cancelledJob.rows.length === 0) {
            return;
        }
        const cancelPublisher = createRedisClient();
        await cancelPublisher.publish(`job:${jobId}:control`, JSON.stringify({ type: 'CANCEL' }));
        await cancelPublisher.quit();
        return { 
            jobId: jobId, 
            status: 'cancelled' as JobStatus,
            result: null,
            error: undefined
        };
    }
}
