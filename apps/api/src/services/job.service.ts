import { Job } from 'bullmq/dist/esm/classes/job';
import { executionQueue } from '../../../../packages/queues/index';
import type { ExecutionJobResponse, ExecutionResult, JobStatus } from '../../../../packages/types/index';
import {pool} from '../../../../packages/db/pool';
import { createRedisClient } from '../../../../packages/config/redis.config';

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
    const job = await pool.query('SELECT id, status, output, error_message FROM jobs WHERE id = $1', [jobId]);
    if(job.rows.length === 0) {
        throw new Error('Job not found');
        console.log(`Job with id ${jobId} not found in database`);
    }
    return {
        jobId : job.rows[0].id,
        status : job.rows[0].status as JobStatus,
        result: job.rows[0].output || null,
        error: job.rows[0].error_message || undefined,
    };
};

export const cancelExecutionJob = async (jobId: string)=>{
    const job = await pool.query(`SELECT id, status FROM jobs WHERE id = $1`, [jobId]);
    if(job.rows.length === 0) {
        return
        console.log(`Job with id ${jobId} not found in database`);
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
