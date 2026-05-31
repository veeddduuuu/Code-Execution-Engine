import { addExecutionJobs } from '../../../../packages/queues/index';
import type { AddExecutionJobData } from '../../../../packages/types';

export async function enqueueExecutionJob(jobData: AddExecutionJobData) {
	const job = await addExecutionJobs(jobData);
	return job;
}