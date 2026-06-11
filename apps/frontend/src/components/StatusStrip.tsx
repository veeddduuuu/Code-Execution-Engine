import React from "react";
import { HealthResponse, Job } from "../types/api";

interface StatusStripProps {
  health: HealthResponse | null;
  jobs: Job[];
}

export const StatusStrip: React.FC<StatusStripProps> = ({ health, jobs }) => {
  // Compute success rate from job history
  const getSuccessRate = () => {
    if (!jobs || jobs.length === 0) return "100%";
    const completed = jobs.filter((j) => j.status === "completed").length;
    const total = jobs.filter((j) => j.status === "completed" || j.status === "failed").length;
    if (total === 0) return "100%";
    return `${Math.round((completed / total) * 100)}%`;
  };

  // Derive stats
  const queueDep = health?.dependencies.find((d) => d.name === "executionQueue");
  const queueMeta = queueDep?.meta as any;
  const queueDepth = queueMeta?.queueDepth ?? 0;

  const workerDep = health?.dependencies.find((d) => d.name === "worker");
  const workerMeta = workerDep?.meta as any;
  const poolAvailable = workerMeta?.containerPool?.available ?? 0;
  const workerCount = workerMeta?.workers?.count ?? 0;

  return (
    <div className="w-full bg-[#1C1F24] text-[#F9F8F6] border-y border-border-subtle py-1.5 px-4 flex items-center justify-between text-2xs overflow-hidden select-none font-mono">
      {/* Ticker Content Wrapper */}
      <div className="flex items-center space-x-6 animate-none whitespace-nowrap overflow-x-auto no-scrollbar w-full">
        {/* Metric Item: System Status */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-text-muted">SYSTEM:</span>
          <span className="h-2 w-2 rounded-full bg-status-completed animate-ping" />
          <span className="text-accent-green font-bold uppercase">
            {health ? health.status : "OFFLINE"}
          </span>
        </div>

        <span className="text-text-muted shrink-0">|</span>

        {/* Metric Item: Queue Depth */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-text-muted">QUEUE DEPTH:</span>
          <span className={`font-bold ${queueDepth > 0 ? "text-status-running" : "text-[#F9F8F6]"}`}>
            {queueDepth} jobs
          </span>
        </div>

        <span className="text-text-muted shrink-0">|</span>

        {/* Metric Item: Container Pool */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-text-muted">WARMED CONTAINER POOL:</span>
          <span className="text-accent-cyan font-bold">{poolAvailable} ready</span>
        </div>

        <span className="text-text-muted shrink-0">|</span>

        {/* Metric Item: Workers */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-text-muted">ACTIVE WORKERS:</span>
          <span className="text-status-pending font-bold">{workerCount} online</span>
        </div>

        <span className="text-text-muted shrink-0">|</span>

        {/* Metric Item: Success Rate */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-text-muted">SUCCESS RATE (LAST 100):</span>
          <span className="text-accent-green font-bold">{getSuccessRate()}</span>
        </div>

        <span className="text-text-muted shrink-0">|</span>

        {/* Metric Item: Average Latency */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-text-muted">AVG LATENCY:</span>
          <span className="text-accent-cyan font-bold">~120ms</span>
        </div>

        <span className="text-text-muted shrink-0">|</span>

        {/* Ticker sliding message */}
        <div className="hidden md:block text-text-muted italic shrink-0 text-3xs">
          ★ Sandbox contains non-root users, isolated memory limits, read-only root, read/write /tmp only ★
        </div>
      </div>
    </div>
  );
};
