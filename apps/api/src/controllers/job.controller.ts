import { Request, Response } from 'express';
import { getExecutionJobById } from '../services/jobs.service';

type JobParams = {
    id: string;
}

export const getJobStatus = async(req: Request<JobParams>, res: Response)=>{
    const jobId = req.params.id;
    
    if(!jobId) {
        return res.status(400).json({ message: 'Job ID is required' });
    }

    const job = await getExecutionJobById(jobId);
    
    if(!job){
        return res.status(404).json({ message: 'Job not found' });
    }

    const result = job.result;
    const error = job.error;
    return res.status(200).json({
        jobId,
        status : job.status,
        result : result || null,
        error : error || null
    });
}