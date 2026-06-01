import { Worker } from 'bullmq';
import { redis } from '../../../../packages/config/redis.config';
import { createContainer } from './../containers/index';
import { Session } from '../../../../packages/types/index';

export const sessionWorker = new Worker('session', async (job) => {
    const sessionId = job.data.sessionId;
    const action = job.data.action;
    
    let containerId: string | null = null;

    switch(action){
        case 'create':
            containerId = await createContainer(sessionId);
            if(!containerId){
                throw new Error(`Container creation failed for session ${sessionId}`);
            }

            const sessionData: Session = {
                sessionId,
                containerId: containerId,
                status: 'created',
                createdAt: Date.now(),
                activeExecutions: 0,
            };
            redis.hset(`session:${sessionId}`, sessionData);
            return sessionData;

        case 'run':
            //run logic
            break;
        
        case 'stop':
            //stop logic
            break;

        default:
            throw new Error(`Unsupported action ${action} for session ${sessionId}`);
    }
});