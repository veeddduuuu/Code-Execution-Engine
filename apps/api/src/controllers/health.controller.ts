import { Request, Response } from 'express';
import { pool } from '../../../../packages/db/pool';
import { createRedisClient } from '../../../../packages/config/redis.config';
import { executionQueue } from '../../../../packages/queues/index';

type DependencyState = 'connected' | 'degraded' | 'warming' | 'unavailable';

type DependencyCheck = {
    name: string;
    label: string;
    state: DependencyState;
    detail: string;
    latencyMs?: number;
    meta?: Record<string, unknown>;
};

const WORKER_HEALTH_URL = process.env.WORKER_HEALTH_URL || 'http://localhost:3001/health';
const HEALTH_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 5000);

const nowMs = () => Number(process.hrtime.bigint() / 1_000_000n);

const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
        return await Promise.race([operation, timeoutPromise]);
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const checkPostgres = async (): Promise<DependencyCheck> => {
    const startedAt = nowMs();
    let client;

    try {
        client = await withTimeout(pool.connect(), HEALTH_TIMEOUT_MS, 'postgres connect');
        const result = await withTimeout(
            client.query<{ database: string; now: Date }>('SELECT current_database() as database, NOW() as now'),
            HEALTH_TIMEOUT_MS,
            'postgres query',
        );

        return {
            name: 'postgres',
            label: 'Postgres',
            state: 'connected',
            detail: `connected to ${result.rows[0]?.database || 'database'}`,
            latencyMs: nowMs() - startedAt,
            meta: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount,
            },
        };
    } catch (error) {
        return {
            name: 'postgres',
            label: 'Postgres',
            state: 'unavailable',
            detail: getErrorMessage(error),
            latencyMs: nowMs() - startedAt,
            meta: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount,
            },
        };
    } finally {
        client?.release();
    }
};

const checkRedis = async (): Promise<DependencyCheck> => {
    const startedAt = nowMs();
    const redis = createRedisClient();

    try {
        const response = await withTimeout(redis.ping(), HEALTH_TIMEOUT_MS, 'redis ping');
        const info = await withTimeout(redis.info('server'), HEALTH_TIMEOUT_MS, 'redis info');
        const version = info.match(/redis_version:([^\r\n]+)/)?.[1];

        return {
            name: 'redis',
            label: 'Redis',
            state: response === 'PONG' ? 'connected' : 'degraded',
            detail: response === 'PONG' ? 'connected' : `unexpected ping response: ${response}`,
            latencyMs: nowMs() - startedAt,
            meta: {
                status: redis.status,
                version,
            },
        };
    } catch (error) {
        return {
            name: 'redis',
            label: 'Redis',
            state: 'unavailable',
            detail: getErrorMessage(error),
            latencyMs: nowMs() - startedAt,
            meta: {
                status: redis.status,
            },
        };
    } finally {
        redis.disconnect();
    }
};

const checkQueue = async (): Promise<DependencyCheck> => {
    const startedAt = nowMs();

    try {
        const [counts, workers] = await withTimeout(
            Promise.all([
                executionQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused', 'waiting-children'),
                executionQueue.getWorkers(),
            ]),
            HEALTH_TIMEOUT_MS,
            'execution queue',
        );

        const queueDepth = (counts.waiting || 0) + (counts.delayed || 0) + (counts['waiting-children'] || 0);

        return {
            name: 'executionQueue',
            label: 'Execution queue',
            state: 'connected',
            detail: `${queueDepth} queued, ${counts.active || 0} active`,
            latencyMs: nowMs() - startedAt,
            meta: {
                queueDepth,
                dlqDepth: counts.failed || 0,
                activeJobs: counts.active || 0,
                counts,
                workerIds: workers.map((worker) => worker.id),
                workerCount: workers.length,
            },
        };
    } catch (error) {
        return {
            name: 'executionQueue',
            label: 'Execution queue',
            state: 'unavailable',
            detail: getErrorMessage(error),
            latencyMs: nowMs() - startedAt,
        };
    }
};

const checkWorker = async (): Promise<DependencyCheck> => {
    const startedAt = nowMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
        const response = await fetch(WORKER_HEALTH_URL, { signal: controller.signal });
        const body = await response.json();
        const workerStatus = body.status as string | undefined;

        return {
            name: 'worker',
            label: 'Worker',
            state: response.ok ? workerStatus === 'healthy' ? 'connected' : 'warming' : 'degraded',
            detail: workerStatus || response.statusText,
            latencyMs: nowMs() - startedAt,
            meta: body,
        };
    } catch (error) {
        return {
            name: 'worker',
            label: 'Worker',
            state: 'unavailable',
            detail: getErrorMessage(error),
            latencyMs: nowMs() - startedAt,
            meta: {
                url: WORKER_HEALTH_URL,
            },
        };
    } finally {
        clearTimeout(timeout);
    }
};

export const getHealth = async (req: Request, res: Response) => {
    const startedAt = nowMs();
    const dependencies = await Promise.all([
        checkPostgres(),
        checkRedis(),
        checkQueue(),
        checkWorker(),
    ]);

    const healthy = dependencies.every((dependency) => dependency.state === 'connected');
    const warming = dependencies.some((dependency) => dependency.state === 'warming');
    const degraded = dependencies.some((dependency) => dependency.state === 'degraded' || dependency.state === 'unavailable');
    const status = healthy ? 'healthy' : warming && !degraded ? 'warming' : 'degraded';

    return res.status(status === 'degraded' ? 503 : 200).json({
        status,
        generatedAt: new Date().toISOString(),
        uptime: process.uptime(),
        latencyMs: nowMs() - startedAt,
        service: {
            name: 'api',
            state: 'connected',
            pid: process.pid,
            node: process.version,
        },
        boot: dependencies.map((dependency) => ({
            id: dependency.name,
            label: dependency.label,
            state: dependency.state,
            detail: dependency.detail,
            latencyMs: dependency.latencyMs,
        })),
        dependencies,
    });
};
