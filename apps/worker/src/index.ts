import "./workers/execution.workers";
import dotenv from 'dotenv';
import express from 'express';
import { executionQueue } from "../../api/src/queue.ts";
import { dot } from "node:test/reporters";

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
    const activeJobs = await executionQueue.getActiveCount();
    const waitingJobs = await executionQueue.getWaitingCount();
    const completedJobs = await executionQueue.getCompletedCount();
    const failedJobs = await executionQueue.getFailedCount();
    const uptime = process.uptime();
    res.status(200).json({ activeJobs, waitingJobs, completedJobs, failedJobs, uptime });
});

app.listen(3001, () => {
    console.log("Worker is running on port 3001");
    console.log(process.env.EXEUCUTION_TIMEOUT_MS);
});