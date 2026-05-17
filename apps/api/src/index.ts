//Create endpoint POST /execute
import express from 'express';
import { addJobs, executionQueueEvents } from './queue';
import type { ExecutionJob, JobStatus } from '../../../packages/types/index';

const app = express();
app.use(express.json({limit : '50kb'}));

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'API is healthy' });
});

const map = new Map<string, Pick<ExecutionJob, 'status' | 'result' | 'error'>>();

executionQueueEvents.on('active', ({ jobId }) => {
    const existing = map.get(jobId);
    map.set(jobId, { status: 'running', result: existing?.result ?? null });
});

executionQueueEvents.on('completed', ({ jobId, returnvalue }) => {
    map.set(jobId, { status: 'completed', result: returnvalue });
});

executionQueueEvents.on('failed', ({ jobId, failedReason }) => {
    map.set(jobId, { status: 'failed', result: null, error: failedReason });
});

app.post('/execute', async (req, res) => {
    const { code, language } = req.body;
    const jobData = { code, language };
    console.log(`Received code to execute`);
    console.log(jobData);   
    try {
        const job = await addJobs(jobData);
        map.set(String(job.id), { status: 'pending', result: null });
        res.status(202).json({ 
            jobId: String(job.id), 
            status : map.get(String(job.id))?.status,
            result : map.get(String(job.id))?.result
            //TODO : wsChannel : add ws channel to listen for job status updates
        });
    } catch (error) {
        console.error('Error adding job to queue:', error);
        res.status(500).json({ message: 'Failed to add code to execution queue' });
    }
});

app.get('/jobs/:id', async (req, res) => {
    const jobId = req.params.id;
    const entry = map.get(jobId);
    if(!entry){
        return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json({ 
        jobId,
        status: entry.status,
        result: entry.result,
        error: entry.error ?? null,
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API server is running on port ${PORT}`);
});
