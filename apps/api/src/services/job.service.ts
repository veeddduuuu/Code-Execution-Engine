import { Job } from 'bullmq/dist/esm/classes/job';
import { executionQueue } from '../../../../packages/queues/index';
import type { ExecutionJobResponse, ExecutionResult, JobStatus } from '../../../../packages/types/index';
import {pool} from '../../../../packages/db/pool';

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