import type { JobStatus } from '../../../../packages/types/index';
import { Request, Response } from 'express';
import { enqueueExecutionJob } from '../services/execution.service';

export const executeCode = async(req: Request, res: Response) => {
	try{
		const { code, language } = req.body;
		const job = await enqueueExecutionJob({
			code,
			language
		});
		return res.status(202).json({
			success: true,
			jobId : String(job.id),
			status : 'pending' as JobStatus,
			result : null,
			wsChannel : `job:${job.id}`,
		});
	}
	catch(error){
		console.error('Error enqueuing execution job:', error);
		return res.status(500).json({ message: 'Failed to enqueue code for execution' });
	}
};
