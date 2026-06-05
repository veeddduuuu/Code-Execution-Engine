import "./workers/execution.workers";
import express from 'express';
import { executionQueue } from "../../../packages/queues/index";

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
    const activeJobs = await executionQueue.getActiveCount();
    const queueDepth = await executionQueue.getJobCounts();
    const workers = await executionQueue.getWorkers();
    // const waitingJobs = await executionQueue.getWaitingCount();
    // const completedJobs = await executionQueue.getCompletedCount();
    // const failedJobs = await executionQueue.getFailedCount();

    const uptime = process.uptime();
    res.status(200).json({ activeJobs, queueDepth, workers, uptime });
});

app.listen(3001, () => {    
    console.log("Worker is running on port 3001");
});
