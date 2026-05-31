import { Request, Response } from 'express';
import Docker from "dockerode";
import { randomUUID } from 'crypto';
import { redis } from '../../../../packages/config/redis.config';
import { Session } from '../../../../packages/types/index';
import { enqueueSessionJob } from '../services/sessions.services';

const docker = new Docker();

//createSession

export const createSession = () => async (req: Request, res: Response) => {
    try {
        const sessionId = randomUUID();
        const container = await docker.createContainer({
            Image: "ubuntu:latest",
            Cmd: ["sleep", "infinity"],
            Labels: {
                "managed-by": "cee",
                "session-id": sessionId,
                "created-at": Date.now().toString(),
            },
        });
        await container.start();
        const containerId = container.id;
        await redis.hset(`session:${sessionId}`, {
            containerId,
            status: "active",
            createdAt: Date.now().toString(),
        });
        res.status(201).json({
            sessionId,
            containerId,
            status: "active",
        });
        console.log(`Created session ${sessionId} with container ${containerId}`);
    } catch (error) {
        res.status(500).json({ message: 'Error creating session', error });
    }
};

//runSession

export const runSession = () => async (req: Request, res: Response) => {
    try {
        const sessionId = req.params.id as string;
        if (!req.body.command || typeof req.body.command !== 'string') {
            return res.status(400).json({ message: 'command is required' });
        }
        const sessionData = await redis.hgetall(`session:${sessionId}`);
        if (!sessionData || Object.keys(sessionData).length === 0) {
            return res.status(404).json({ message: 'Session not found' });
        }
        const jobData = {
            sessionId,
            command: req.body.command as string,
        }

        const job = await enqueueSessionJob(jobData);

        res.status(200).json({
            jobId: job.id,
            status: "queued"
        });
        console.log(`Enqueued job ${job.id} for session ${sessionId} with jobData:`, jobData);

    } catch (error) {
        res.status(500).json({ message: 'Error starting session', error });
    }
};

//getSession

export const getSession = () => async (req: Request, res: Response) => {
    try {
        const sessionId = req.params.id as string;
        const sessionData = await redis.hgetall(`session:${sessionId}`);
        if (!sessionData || Object.keys(sessionData).length === 0) {
            return res.status(404).json({ message: 'Session not found' });
        }
        const session: Session = {
            sessionId,
            containerId: sessionData.containerId,
            status: sessionData.status as 'created' | 'running' | 'stopped',
            createdAt: parseInt(sessionData.createdAt, 10),
        };
        res.status(200).json(session);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving sessions', error });
    }
};

//stopSession

export const stopSession = () => async (req: Request, res: Response) => {
    try {
        const sessionId = req.params.id as string;
        const containerId = await redis.hget(`session:${sessionId}`, 'containerId');
        if (!containerId) {
            return res.status(404).json({ message: 'Session not found' });
        }
        const container = docker.getContainer(containerId);
        await container.stop();
        await container.remove();
        await redis.hset(`session:${sessionId}`, { status: 'stopped' });
        const session: Session = {
            sessionId,
            containerId,
            status: 'stopped'
        };
        res.status(200).json(session);
    } catch (error) {
        res.status(500).json({ message: 'Error stopping session', error });
    }
};