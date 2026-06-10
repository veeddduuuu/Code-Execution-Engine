export type DependencyState = "connected" | "degraded" | "warming" | "unavailable";

export type DependencyCheck = {
    name: string;
    label: string;
    state: DependencyState;
    detail: string;
    latencyMs?: number;
    meta?: Record<string, unknown>;
};

export type HealthResponse = {
    status: "healthy" | "warming" | "degraded";
    generatedAt: string;
    uptime: number;
    latencyMs: number;
    service: {
        name: string;
        state: string;
        pid: number;
        node: string;
    };
    boot: Array<{
        id: string;
        label: string;
        state: DependencyState;
        detail: string;
        latencyMs?: number;
    }>;
    dependencies: DependencyCheck[];
};

export type Job = {
    jobId: string;
    status: "pending" | "running" | "completed" | "failed" | "cancelled" | "dead";
    result: string | null;
    error: string | undefined;
    createdAt: string;
};

type QueueHealthMeta = {
    queueDepth?: number;
    dlqDepth?: number;
    workerCount?: number;
    workerIds?: string[];
};

type WorkerHealthMeta = {
    containerPool?: { available?: number };
    workers?: { count?: number; workerIds?: string[] };
    queue?: { queueDepth?: number };
};

export function getHealthSummary(health: HealthResponse) {
    const queueDep = health.dependencies.find((dependency) => dependency.name === "executionQueue");
    const workerDep = health.dependencies.find((dependency) => dependency.name === "worker");
    const queueMeta = queueDep?.meta as QueueHealthMeta | undefined;
    const workerMeta = workerDep?.meta as WorkerHealthMeta | undefined;

    return {
        status: health.status,
        queueDepth: queueMeta?.queueDepth ?? workerMeta?.queue?.queueDepth ?? 0,
        poolAvailable: workerMeta?.containerPool?.available ?? 0,
        workerCount: queueMeta?.workerCount ?? workerMeta?.workers?.count ?? queueMeta?.workerIds?.length ?? 0,
    };
}
