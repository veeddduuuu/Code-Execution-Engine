import express from 'express';
import { executionQueue, addJobs } from "./../../../packages/queues/index.ts";
import type { ExecutionJob, JobStatus, ExecutionResult, AddJobData } from '../../../packages/types/index';
import {WebSocketServer, WebSocket} from 'ws';
import http from 'http';
import { createRedisClient } from '../../../packages/config/redis.config.ts';

const redis = createRedisClient();
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({
    server:server,
    path : '/ws'
});
const clients = new Map<string, import('ws').WebSocket>();

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket on /ws');
    ws.on('message', (message) => {
        try{
            const parsedMessage = JSON.parse(message.toString());
            const type = parsedMessage.type;
            const jobId = parsedMessage.jobId;
            if(type === 'subscribe' && jobId){
                console.log(`Client subscribed to jobId ${jobId}`);
                clients.set(`job:${jobId}`, ws);
                redis.subscribe(`job:${jobId}`, (err, count) => {
                    if (err) {
                        console.error('Failed to subscribe to Redis channel:', err);
                    } else {
                        console.log(`Subscribed to Redis channel. Subscription count: ${count}`);
                    }
                });
                ws.send(JSON.stringify({ message: `Subscribed to jobId ${jobId}` }));
            }
        }
        catch(error){
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        for(const [job, socket] of clients.entries()){
            if(socket === ws){
                clients.delete(job);
                console.log(`Client unsubscribed from ${job}`);
                break;
            }
        }
    });
});

redis.on('message', (channel, message) => {
    console.log(`Received message from Redis channel ${channel}: ${message}`);
    clients.get(channel)?.send(JSON.stringify({ channel, message }));
});

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
            wsChannel : `job:${job.id}` 
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
server.listen(PORT, () => {
    console.log(`API server is running on port ${PORT}`);
});
