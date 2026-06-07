import Docker from 'dockerode';
import { createRedisClient } from '../../../../packages/config/redis.config';

const redisClient = createRedisClient();
const docker = new Docker();

const createContainer = async()=>{
    let container : Docker.Container | undefined = undefined;
    try {
        container = await docker.createContainer({
            Image: 'node:20-alpine',
            Cmd: ['sleep', 'infinity'],
            HostConfig: {
                Memory: 1024 * 1024 * 128,
                NanoCpus: 500_000_000,
                NetworkMode: "none",
                AutoRemove: false,
                //Binds: [`workpace`]
        }
    });
    await container.start();
    return container;
    } catch (err) {
        console.error('Error creating container:', err);
        throw err;
    }
}

const minPoolSize = 5;

export const initialisePool = async () => {
  // Implementation for initialising the container pool
    for(let i = 0; i < minPoolSize; i++) {
        const newContainer = await createContainer();
        await redisClient.rpush('container_pool', newContainer.id);
    }

};

export const acquireContainer = async () => {
  // Implementation for acquiring a container from the pool
    const containerId = await redisClient.lpop('container_pool');
    if (!containerId) {
        console.log('No available containers in the pool, creating a new one...');
        return await createContainer();
    }
    return docker.getContainer(containerId);
} 


export const releaseContainer = async (containerId: string) => {    
    // Implementation for releasing a container back to the pool
    const container = docker.getContainer(containerId);
    try{
        await container.remove({force: true});
        const replacementContainer = await createContainer();
        await redisClient.rpush('container_pool', replacementContainer.id);
    }
    catch(err){
        console.error(`Could not release container : ${containerId}:`, err);
    }
}

export const replenishPool = async () => {
    // Implementation for replenishing the pool with new containers if needed
    const poolSize = await redisClient.llen('container_pool');
    const minPoolSize = 5;
    if (poolSize < minPoolSize) {
        for (let i = poolSize; i < minPoolSize; i++) {
            const newContainer = await createContainer();
            await redisClient.rpush('container_pool', newContainer.id);
        }
    }
}

export const healthCheck = async () => {
    
}