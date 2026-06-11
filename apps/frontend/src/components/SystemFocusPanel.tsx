import React, { useState } from "react";
import { HealthResponse } from "../types/api";

interface SystemFocusPanelProps {
  health: HealthResponse | null;
  dlqJobs: any[];
  onReplayDlq: (jobId: string) => void;
}

export const SystemFocusPanel: React.FC<SystemFocusPanelProps> = ({
  health,
  dlqJobs,
  onReplayDlq,
}) => {
  const [activeTab, setActiveTab] = useState<"queue" | "workers" | "pool" | "dlq">("queue");

  // Extract meta variables safely
  const findDep = (name: string) => health?.dependencies.find((d) => d.name === name);
  const queueDep = findDep("executionQueue");
  const workerDep = findDep("worker");

  const queueMeta = queueDep?.meta as any;
  const workerMeta = workerDep?.meta as any;

  const queueDepth = queueMeta?.queueDepth ?? 0;
  const dlqDepth = queueMeta?.dlqDepth ?? 0;
  const activeJobs = queueMeta?.activeJobs ?? 0;
  const counts = queueMeta?.counts ?? {};

  const workerCount = workerMeta?.workers?.count ?? 0;
  const workerIds = workerMeta?.workers?.workerIds ?? [];

  const pool = workerMeta?.containerPool ?? { available: 0, active: 0, warming: false };
  const poolAvailable = pool.available ?? 0;
  const poolActive = pool.active ?? 0;
  const poolTotal = poolAvailable + poolActive;

  return (
    <div className="flex flex-col h-full bg-bg-surface rounded border border-border-subtle shadow-sm overflow-hidden">
      {/* Tab Select Header */}
      <div className="flex border-b border-border-subtle bg-bg-muted">
        {(["queue", "workers", "pool", "dlq"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab.toUpperCase();
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-2xs font-bold font-mono border-r border-border-subtle last:border-r-0 transition-colors ${
                isActive
                  ? "bg-bg-surface text-accent border-b-2 border-b-accent"
                  : "text-text-secondary hover:bg-bg-page"
              }`}
            >
              {label} {tab === "dlq" && dlqJobs.length > 0 && `(${dlqJobs.length})`}
            </button>
          );
        })}
      </div>

      {/* Tab Content Body */}
      <div className="p-4 flex-grow overflow-y-auto min-h-[200px]">
        {activeTab === "queue" && (
          <div className="space-y-4">
            <h4 className="text-2xs font-mono font-bold text-text-secondary uppercase">
              Execution Queue (BullMQ / Redis)
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-bg-page rounded border border-border-subtle">
                <span className="text-3xs text-text-secondary uppercase font-semibold">Queue Depth</span>
                <p className="font-mono text-lg font-bold text-text-primary mt-1">{queueDepth}</p>
              </div>
              <div className="p-3 bg-bg-page rounded border border-border-subtle">
                <span className="text-3xs text-text-secondary uppercase font-semibold">Active Jobs</span>
                <p className="font-mono text-lg font-bold text-text-primary mt-1">{activeJobs}</p>
              </div>
              <div className="p-3 bg-bg-page rounded border border-border-subtle">
                <span className="text-3xs text-text-secondary uppercase font-semibold">Completed Runs</span>
                <p className="font-mono text-lg font-bold text-accent-green mt-1">{counts.completed ?? 0}</p>
              </div>
              <div className="p-3 bg-bg-page rounded border border-border-subtle">
                <span className="text-3xs text-text-secondary uppercase font-semibold">Failed Retries</span>
                <p className="font-mono text-lg font-bold text-accent-red mt-1">{counts.failed ?? 0}</p>
              </div>
            </div>
            <div className="text-3xs text-text-secondary leading-normal font-mono border-t border-border-subtle pt-2">
              <p>Redis Status: {findDep("redis")?.state === "connected" ? "Connected" : "Disconnected"}</p>
              <p>BullMQ Prefix: "cee-execution"</p>
            </div>
          </div>
        )}

        {activeTab === "workers" && (
          <div className="space-y-3">
            <h4 className="text-2xs font-mono font-bold text-text-secondary uppercase">
              Active Workers ({workerCount})
            </h4>
            {workerIds.length === 0 ? (
              <p className="text-xs text-text-secondary italic">No active worker daemons registered.</p>
            ) : (
              <div className="space-y-2">
                {workerIds.map((id: string, idx: number) => (
                  <div
                    key={id}
                    className="flex items-center justify-between p-2 bg-bg-page rounded border border-border-subtle text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-status-completed" />
                      <span className="font-mono font-semibold text-text-primary truncate max-w-[200px]">
                        worker-{id.slice(0, 8)}
                      </span>
                    </div>
                    <span className="text-3xs font-mono bg-[#E6DED2] px-1.5 py-0.5 rounded text-text-secondary">
                      Idle
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-3xs text-text-secondary font-mono leading-normal pt-2 border-t border-border-subtle">
              Workers execute isolated scripts and stream stdio outputs over Redis Pub/Sub backchannels.
            </p>
          </div>
        )}

        {activeTab === "pool" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-2xs font-mono font-bold text-text-secondary uppercase">
                Pre-Warmed Sandbox Pool
              </h4>
              <span className={`text-3xs px-2 py-0.5 rounded font-mono font-semibold ${
                pool.warming ? "bg-status-running/10 text-status-running border border-status-running/30" : "bg-status-completed/10 text-status-completed border border-status-completed/30"
              }`}>
                {pool.warming ? "WARMING" : "HEALTHY"}
              </span>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {/* Generate boxes representing container slots */}
              {Array.from({ length: Math.max(poolTotal, 5) }).map((_, idx) => {
                let state: "available" | "active" | "empty" = "empty";
                if (idx < poolActive) {
                  state = "active";
                } else if (idx < poolTotal) {
                  state = "available";
                }

                return (
                  <div
                    key={idx}
                    className={`aspect-square rounded border flex flex-col items-center justify-center relative group cursor-help transition-all ${
                      state === "active"
                        ? "bg-status-running/20 border-status-running text-status-running"
                        : state === "available"
                        ? "bg-status-completed/20 border-status-completed text-status-completed"
                        : "bg-bg-page border-border-subtle text-text-secondary opacity-40"
                    }`}
                  >
                    <span className="text-3xs font-bold font-mono">C{idx + 1}</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-[#1D2024] text-[#F9F8F6] text-3xs px-1.5 py-0.5 rounded whitespace-nowrap z-10 shadow-lg">
                      {state === "active" ? "Running Job Container" : state === "available" ? "Pre-Warmed & Idle" : "Unallocated Slot"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-3xs text-text-secondary font-mono leading-normal pt-2 border-t border-border-subtle space-y-1">
              <div className="flex justify-between">
                <span>Available containers:</span>
                <span className="font-bold text-accent-green">{poolAvailable}</span>
              </div>
              <div className="flex justify-between">
                <span>Active allocations:</span>
                <span className="font-bold text-accent-amber">{poolActive}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "dlq" && (
          <div className="space-y-3">
            <h4 className="text-2xs font-mono font-bold text-text-secondary uppercase">
              Dead Letter Queue ({dlqJobs.length})
            </h4>
            {dlqJobs.length === 0 ? (
              <p className="text-xs text-text-secondary italic">No dead jobs found in database logs.</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {dlqJobs.map((job) => (
                  <div
                    key={job.jobId}
                    className="p-2.5 bg-bg-page rounded border border-border-subtle text-2xs flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono font-bold text-text-primary">
                        id: {job.jobId.slice(0, 8)}...
                      </span>
                      <span className="font-mono text-accent-red uppercase tracking-wider font-semibold">
                        DEAD
                      </span>
                    </div>
                    <p className="text-text-secondary truncate mb-2">{job.error || "Execution error context"}</p>
                    <button
                      onClick={() => onReplayDlq(job.jobId)}
                      className="px-2 py-1 bg-accent hover:bg-accent/80 text-text-inverse font-mono font-bold rounded text-3xs transition-colors self-end"
                    >
                      Replay Job
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
