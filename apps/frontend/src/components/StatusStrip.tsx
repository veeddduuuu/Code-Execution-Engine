import React from "react";
import { HealthResponse, Job } from "../types/api";
import { AnimatedNumber } from "./AnimatedNumber";

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
    <div className="fixed bottom-0 left-0 w-full bg-[var(--bg-glass)] backdrop-blur-3xl text-text-secondary border-t border-white/5 py-1 px-4 flex items-center justify-between text-[10px] select-none font-mono z-50">
      <div className="flex items-center space-x-4">
        {/* Metric Item: System Status */}
        <div className="flex items-center space-x-1.5 cursor-pointer hover:text-text-primary transition-colors">
          <span className={`h-1.5 w-1.5 rounded-full ${health?.status === "healthy" ? "bg-status-completed shadow-[0_0_8px_var(--status-completed)]" : "bg-status-failed animate-pulse"}`} />
          <span className="uppercase tracking-wider font-bold">
            {health?.status === "healthy" ? "SYSTEM ONLINE" : "SYSTEM DEGRADED"}
          </span>
        </div>
        
        <div className="h-3 w-px bg-white/10" />

        {/* Metric Item: Container Pool */}
        <div className="flex items-center space-x-2 cursor-pointer hover:text-text-primary transition-colors">
          <span>POOL:</span>
          <span className="text-text-primary font-bold"><AnimatedNumber value={poolAvailable} /> WARM</span>
        </div>

        <div className="h-3 w-px bg-white/10" />

        {/* Metric Item: Workers */}
        <div className="flex items-center space-x-2 cursor-pointer hover:text-text-primary transition-colors">
          <span>WORKERS:</span>
          <span className="text-text-primary font-bold"><AnimatedNumber value={workerCount} /> ACTIVE</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Metric Item: Queue Depth */}
        <div className="flex items-center space-x-2 cursor-pointer hover:text-text-primary transition-colors">
          <span>QUEUE:</span>
          <span className="text-text-primary font-bold"><AnimatedNumber value={queueDepth} /></span>
        </div>

        <div className="h-3 w-px bg-white/10" />

        {/* Metric Item: Success Rate */}
        <div className="flex items-center space-x-2 cursor-pointer hover:text-text-primary transition-colors">
          <span>SUCCESS RATE:</span>
          <span className="text-accent-green font-bold">{getSuccessRate()}</span>
        </div>
      </div>
    </div>
  );
};
