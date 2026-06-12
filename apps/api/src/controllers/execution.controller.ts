import type { JobStatus } from '../../../../packages/types/index';
import { Request, Response } from 'express';
import { addExecutionJobs } from '../../../../packages/queues/index';
import { pool } from '../../../../packages/db/pool';
import crypto from 'crypto';

export const executeCode = async (req: Request, res: Response) => {
	const { idempotencyKey, code, language, jobId: requestedJobId } = req.body;
	const keyHash = idempotencyKey ? crypto.createHash('sha256').update(idempotencyKey).digest('hex') : null;

	const jobId = requestedJobId || crypto.randomUUID();
	const jobValues = [jobId, code, language, 'pending'];
	const idempotencyValues = [keyHash, jobId];

	if (idempotencyKey) {
		const lookupResult = await pool.query(`SELECT j.id, j.status FROM idempotency i JOIN jobs j ON i.job_id = j.id WHERE i.key = $1 AND i.created_at > NOW()- INTERVAL '24 hours'`, [keyHash]);
		if (lookupResult.rows.length > 0) {
			return res.status(200).json({
				jobId: lookupResult.rows[0].id,
				status: lookupResult.rows[0].status
			});
		}
	}

	const client = await pool.connect();
	try {
		await client.query("Begin");
		await client.query('INSERT INTO jobs (id, code, language, status) VALUES ($1, $2, $3, $4)', jobValues);
		if (keyHash) await client.query('INSERT INTO idempotency (key, job_id) VALUES ($1, $2)', idempotencyValues);
		await client.query("Commit");
	} catch (error) {
		await client.query("Rollback");
		console.error('Error starting transaction:', error);
		return res.status(500).json({ message: 'Failed to write to database' });
	} finally {
		client.release();
	}

	try {
		const job = await addExecutionJobs({
			jobId: jobId,
			code,
			language

		});
		return res.status(202).json({
			success: true,
			jobId: jobId,
			status: 'pending' as JobStatus,
			result: null,
			wsChannel: `job:${jobId}`,
		});
	}
	catch (error) {
		console.error('Error enqueuing execution job:', error);
		const updateFailedQuery = 'UPDATE jobs SET status = $1, error_message = $2, completed_at = $3, exit_code = $4 WHERE id = $5';
		const values = ['failed', error, new Date(), 1, jobId];
		await pool.query(updateFailedQuery, values);
		return res.status(500).json({ message: 'Failed to enqueue code for execution' });
	}
};
