import {Request, Response} from 'express';
import Docker from "dockerode";
import {randomUUID} from 'crypto';
import { redis } from '../../../../packages/config/redis.config';
import { AddSessionJobData, Session } from '../../../../packages/types/index';
import { enqueueSessionJob } from '../services/sessions.services';

const docker = new Docker();

//createSession

export const createSession = () => async (req: Request, res: Response) => {
    try {
        const sessionId = randomUUID();
        const container = await docker.createContainer({
            Image: "node:22-alpine",
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
    } catch (error) {
        res.status(500).json({ message: 'Error creating session', error });
    }
};

//runSession

export const runSession = () => async (req: Request, res: Response) => {
    try {
        const sessionId = req.params.id;
        const sessionData = await redis.hgetall(`session:${sessionId}`);
        if (!sessionData || Object.keys(sessionData).length === 0) {
            return res.status(404).json({ message: 'Session not found' });
        }
        const jobData : AddSessionJobData = {
            sessionId,
            code: req.body.code,
            language : req.body.language
        };

        const job = await enqueueSessionJob(jobData);

        res.status(200).json({

        });
    } catch (error) {
        res.status(500).json({ message: 'Error starting session', error });
    }
};

//getSessions

export const getSessions = () => async (req: Request, res: Response) => {
    try {
        const sessionId = req.params.id;
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
        const sessionId = req.params.id;
        const containerId = await redis.hget(`session:${sessionId}`, 'containerId');
        if (!containerId) {
            return res.status(404).json({ message: 'Session not found' });
        }
        const container = docker.getContainer(containerId);
        await container.stop();
        await container.remove();
        await redis.hset(`session:${sessionId}`, {status: 'stopped'});
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