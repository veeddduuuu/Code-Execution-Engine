import type { JobStatus } from '../../../../packages/types/index';
import { Request, Response } from 'express';
import { addExecutionJobs } from '../../../../packages/queues/index';
import { pool } from '../../../../packages/db/pool';
import crypto from 'crypto';

export const executeCode = async(req: Request, res: Response) => {
	const { code, language } = req.body;
	const jobId = crypto.randomUUID();
	const insertQuery = 'INSERT INTO jobs (id, code, language, status) VALUES ($1, $2, $3, $4) RETURNING id';
	const values = [jobId, code, language, 'pending'];
	await pool.query(insertQuery, values);
	
	try {		
		const job = await addExecutionJobs({
			jobId: jobId,
			code,
			language
		});
		return res.status(202).json({
			success: true,
			jobId : jobId,
			status : 'pending' as JobStatus,
			result : null,
			wsChannel : `job:${jobId}`,
		});
	}
	catch(error){
		console.error('Error enqueuing execution job:', error);	
		const updateFailedQuery = 'UPDATE jobs SET status = $1, error_message = $2, completed_at = $3, exit_code = $4 WHERE id = $5';
		const values = ['failed', error, new Date(), 1, jobId];
		await pool.query(updateFailedQuery, values);
		return res.status(500).json({ message: 'Failed to enqueue code for execution' });
	}
};
