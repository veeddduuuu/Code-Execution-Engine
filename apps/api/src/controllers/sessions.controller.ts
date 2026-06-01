import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { addSessionJobs } from "../../../../packages/queues/index";
import { SessionJobData } from "../../../../packages/types";

export const createSession = () => async (req: Request, res: Response) => {

    try{
        const sessionId = randomUUID();

        const jobData : SessionJobData = {
            sessionId,
            action: 'create'
        };
        const job = await addSessionJobs(jobData);

        res.status(201).json({
            sessionId,
            jobId: job.id,
            status: "queued",
        });
        console.log(`Created session ${sessionId} with job ${job.id}`);
    }
    catch(error){
        res.status(500).json({ message: 'Error creating session', error });
    }
}  
