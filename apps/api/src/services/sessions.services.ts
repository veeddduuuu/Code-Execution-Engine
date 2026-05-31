import { AddSessionJobData } from "../../../../packages/types";
import { addSessionJobs } from "../../../../packages/queues/index";

export async function enqueueSessionJob(jobData : AddSessionJobData) {
        const job = await addSessionJobs(jobData);
        return job;
}