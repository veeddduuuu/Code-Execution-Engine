//Create endpoint POST /execute
import express from 'express';
import { executionQueue, addJobs } from "./../../../packages/queues/index.ts";
import type { ExecutionJob, JobStatus, ExecutionResult, AddJobData } from '../../../packages/types/index';

const app = express();
app.use(express.json({limit : '50kb'}));

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'API is healthy' });
});

app.post('/execute', async (req, res) => {
    const { code, language } = req.body;
    const jobData = { code, language };
    console.log(`Received code to execute`);
    console.log(jobData);   
    try {
        const job = await addJobs(jobData);
        res.status(202).json({ 
            jobId: String(job.id), 
            status : 'pending' as JobStatus,
            result : null,
            //TODO : wsChannel : add ws channel to listen for job status updates
        });
    } catch (error) {
        console.error('Error adding job to queue:', error);
        res.status(500).json({ message: 'Failed to add code to execution queue' });
    }
});

app.get('/jobs/:id', async (req, res) => {
    const jobId = req.params.id;
    const job = await executionQueue.getJob(jobId);
    if (!job) {
        return res.status(404).json({ message: 'Job not found' });
    }
    const state = await job.getState();


    let status: JobStatus;
    switch (state) {
        case 'waiting':
        case 'delayed':
            status = 'pending';
            break;
        case 'active':
            status = 'running';
            break;
        case 'completed':
            status = 'completed';
            break;
        case 'failed':
            status = 'failed';
            break;
        default:
            status = 'pending';
    }

    const result = await job.returnvalue;
    const error = job.failedReason;

    res.status(200).json({ 
        jobId,
        status: status as JobStatus,
        result: result as ExecutionResult,
        error: error || null,
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API server is running on port ${PORT}`);
});
