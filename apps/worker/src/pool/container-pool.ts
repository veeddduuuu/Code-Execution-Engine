//Pool stored in Redis list pool:node:available, 
// LPOP on acquire, 
// replenish after use, 
// health check every 30s, startup cleanup, 
// labels on containers.

import Docker from 'dockerode';
import { createRedisClient } from '../../../../packages/config/redis.config';

const redisClient = createRedisClient();
const docker = new Docker();
export const POOL_SIZE = 5;

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
                Binds: ['/tmp/cee:/workspace']
            },
            Labels: {
                'managed-by': 'code-execution-engine',
                'pool-id' : 'worker-pool',
                'created-at': new Date().toISOString(),
            }
        }); 
        await container.start();
        return container;
    } 
    catch (err) {
        console.error('Error creating container:', err);
        throw err;
    }
}


export const initialisePool = async () => {
  // Implementation for initialising the container pool
    for(let i = 0; i < POOL_SIZE; i++) {
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
    const remianing = await redisClient.llen('container_pool');
    if(remianing < 2){
        console.log(`Only ${remianing} containers left in the pool, replenishing...`);
        replenishPool().catch(err => console.error('Error replenishing pool:', err));
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
    if (poolSize < POOL_SIZE) {
        for (let i = poolSize; i < POOL_SIZE; i++) {
            const newContainer = await createContainer();
            await redisClient.rpush('container_pool', newContainer.id);
        }
    }
}

export const healthCheck = async () => {
    const containerIds = await redisClient.lrange('container_pool', 0, -1);
    for (const containerId of containerIds) {
        const inspect = await docker.getContainer(containerId).inspect();
        if(!inspect.State.Running){
            await redisClient.lrem('container_pool', 0, containerId);
            const replacementContainer  = await createContainer();
            await redisClient.rpush('container_pool', replacementContainer.id);
        }
    }
}

export const getContainerPoolSnapshot = async () => {
    const containerIds = await redisClient.lrange('container_pool', 0, -1);
    const inspections = await Promise.allSettled(
        containerIds.map(async (containerId) => {
            const inspect = await docker.getContainer(containerId).inspect();
            return {
                id: containerId,
                running: Boolean(inspect.State.Running),
                status: inspect.State.Status,
                image: inspect.Config.Image,
            };
        })
    );

    const containers = inspections.map((inspection, index) => {
        if (inspection.status === 'fulfilled') {
            return inspection.value;
        }

        return {
            id: containerIds[index],
            running: false,
            status: 'missing',
            error: inspection.reason instanceof Error ? inspection.reason.message : String(inspection.reason),
        };
    });

    return {
        target: POOL_SIZE,
        available: containerIds.length,
        running: containers.filter((container) => container.running).length,
        warming: containerIds.length < POOL_SIZE,
        containers,
    };
};

export const cleanupOrphanedContainers = async () => {
    const containers = await docker.listContainers({
        all: true,
        filters: {
            label: ["managed-by=code-execution-engine"]
        }
    });

    for (const container of containers) {
        try {
            await docker
                .getContainer(container.Id)
                .remove({ force: true });
        } catch (err) {
            console.error(
                `Failed to cleanup ${container.Id}`,
                err
            );
        }
    }

    await redisClient.del("container_pool");
}
