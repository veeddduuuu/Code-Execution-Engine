import "./workers/execution.workers";
import express from 'express';
import { executionQueue } from "../../../packages/queues/index";
import { cleanupOrphanedContainers, getContainerPoolSnapshot, healthCheck, initialisePool } from "./pool/container-pool";

const app = express();
const PORT = Number(process.env.PORT_WORKER || 3001);
const bootState = {
    status: 'warming',
    startedAt: new Date().toISOString(),
    readyAt: null as string | null,
    error: null as string | null,
};

app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        const [counts, workers, containerPool] = await Promise.all([
            executionQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused', 'waiting-children'),
            executionQueue.getWorkers(),
            getContainerPoolSnapshot(),
        ]);
        const queueDepth = (counts.waiting || 0) + (counts.delayed || 0) + (counts['waiting-children'] || 0);
        const status = bootState.status === 'ready' && !containerPool.warming ? 'healthy' : 'warming';

        res.status(200).json({
            status,
            uptime: process.uptime(),
            boot: bootState,
            queue: {
                queueDepth,
                dlqDepth: counts.failed || 0,
                activeJobs: counts.active || 0,
                counts,
            },
            workers: {
                count: workers.length,
                workerIds: workers.map((worker) => worker.id),
            },
            containerPool,
        });
    } catch (error) {
        res.status(503).json({
            status: 'degraded',
            uptime: process.uptime(),
            boot: bootState,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

async function startWorker() {
    console.log("Starting worker...");
    await cleanupOrphanedContainers();
    await initialisePool();
    await healthCheck();
    bootState.status = 'ready';
    bootState.readyAt = new Date().toISOString();
    console.log("Worker pool initialised");

    app.listen(PORT, () => {    
    console.log(`Worker is running on port ${PORT}`);
    });
}

startWorker().catch(err => {
    bootState.status = 'failed';
    bootState.error = err instanceof Error ? err.message : String(err);
    console.error("Error starting worker:", err);
    process.exit(1);
});
