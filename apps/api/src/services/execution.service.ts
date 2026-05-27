import { addJobs } from '../../../../packages/queues/index';
import type { AddJobData } from '../../../../packages/types';

export async function enqueueExecutionJob(jobData: AddJobData) {
	const job = await addJobs(jobData);
	return job;
}