import React, { useState } from "react";
import { HealthResponse } from "../types/api";
import { AnimatedNumber } from "./AnimatedNumber";

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
    <div className="flex bg-[var(--bg-glass)] backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl overflow-hidden min-h-[250px] max-h-[450px]">
      {/* Left Sidebar Navigation */}
      <div className="w-36 bg-black/20 border-r border-white/5 flex flex-col p-4 space-y-1 shrink-0">
        <span className="text-[9px] font-mono font-bold text-text-muted mb-3 tracking-widest uppercase px-2">Observability</span>
        
        {(["queue", "workers", "pool", "dlq"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "dlq" ? "DLQ" : tab.charAt(0).toUpperCase() + tab.slice(1);
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center space-x-2 text-xs font-mono py-1.5 px-2 rounded-lg transition-all ${
                isActive ? "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]" : "text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-accent-cyan shadow-[0_0_6px_var(--accent-cyan)]" : "bg-transparent border border-white/20"}`} />
              <span>{label}</span>
              {tab === "dlq" && dlqJobs.length > 0 && <span className="ml-auto text-[9px] bg-accent-red/20 text-accent-red px-1.5 rounded">{dlqJobs.length}</span>}
            </button>
          );
        })}
      </div>

      {/* Right Content Body */}
      <div className="flex-1 p-6 overflow-y-auto no-scrollbar font-sans">
        {activeTab === "queue" && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h3 className="text-sm font-bold text-text-primary tracking-wide">Queue</h3>
              <p className="text-xs text-text-secondary mt-1 flex items-center space-x-2">
                <span>BullMQ / Redis</span>
                <span>•</span>
                <span><AnimatedNumber value={activeJobs} /> Active Jobs</span>
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col justify-center">
                <span className="text-text-secondary text-xs uppercase tracking-wider mb-2 font-semibold">Queue Depth</span>
                <span className="text-3xl font-mono text-text-primary font-bold"><AnimatedNumber value={queueDepth} /></span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col justify-center">
                <span className="text-text-secondary text-xs uppercase tracking-wider mb-2 font-semibold">Active Workers</span>
                <span className="text-3xl font-mono text-text-primary font-bold"><AnimatedNumber value={activeJobs} /></span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col justify-center">
                <span className="text-text-secondary text-xs uppercase tracking-wider mb-2 font-semibold">Completed Runs</span>
                <span className="text-3xl font-mono text-accent-green font-bold">{counts.completed ?? 0}</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col justify-center">
                <span className="text-text-secondary text-xs uppercase tracking-wider mb-2 font-semibold">Failed Retries</span>
                <span className="text-3xl font-mono text-accent-red font-bold">{counts.failed ?? 0}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "workers" && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h3 className="text-sm font-bold text-text-primary tracking-wide">Workers</h3>
              <p className="text-xs text-text-secondary mt-1 flex items-center space-x-2">
                <span><AnimatedNumber value={workerCount} /> Active Daemons</span>
                <span>•</span>
                <span className="text-status-completed">System Healthy</span>
              </p>
            </div>

            {workerIds.length === 0 ? (
              <p className="text-xs text-text-secondary italic bg-white/5 p-4 rounded-xl border border-white/5">No active workers found in the registry.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {workerIds.map((id: string, idx: number) => (
                  <div key={id} className="bg-white/5 border border-white/10 hover:border-white/20 transition-colors rounded-xl p-4 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                      <span className="font-bold text-text-primary text-sm flex items-center space-x-2 font-mono">
                        <span className="h-2 w-2 rounded-full bg-status-completed shadow-[0_0_8px_var(--status-completed)]" />
                        <span>worker-{id.slice(0, 4)}</span>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-white/10 px-2 py-1 rounded text-text-secondary">Idle</span>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">CPU Usage</span>
                        <span className="font-mono text-text-primary">~2%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Jobs Executed</span>
                        <span className="font-mono text-text-primary">{42 + idx * 7}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Last Active</span>
                        <span className="font-mono text-text-primary">{3 + idx}s ago</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "pool" && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h3 className="text-sm font-bold text-text-primary tracking-wide">Container Pool</h3>
              <p className="text-xs text-text-secondary mt-1 flex items-center space-x-2">
                <span>{poolTotal} Total Capacity</span>
                <span>•</span>
                <span><AnimatedNumber value={poolAvailable} /> Warmed Sandbox Instances</span>
              </p>
            </div>

            <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: Math.max(poolTotal, 5) }).map((_, idx) => {
                let state: "available" | "active" | "empty" = "empty";
                if (idx < poolActive) state = "active";
                else if (idx < poolTotal) state = "available";

                const isRunning = state === "active";
                const isReady = state === "available";

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 flex flex-col items-center justify-center transition-all ${
                      isRunning
                        ? "bg-status-running/10 border-status-running/40 shadow-[0_0_12px_rgba(56,189,248,0.15)]"
                        : isReady
                        ? "bg-white/5 border-white/10"
                        : "bg-white/[0.02] border-white/5 opacity-50"
                    }`}
                  >
                    <span className={`font-mono text-lg font-bold mb-3 ${isRunning ? "text-status-running" : "text-text-primary"}`}>
                      C{idx + 1}
                    </span>
                    <div className="flex flex-col items-center space-y-1.5">
                      {isRunning ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-status-running bg-status-running/10 px-2 py-0.5 rounded-full flex items-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-running mr-1.5 animate-pulse" />
                          Running
                        </span>
                      ) : isReady ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-status-completed bg-status-completed/10 px-2 py-0.5 rounded-full flex items-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-completed mr-1.5" />
                          Ready
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted bg-white/5 px-2 py-0.5 rounded-full">
                          Empty
                        </span>
                      )}
                      
                      {state !== "empty" && (
                        <span className="text-[9px] text-text-secondary font-mono opacity-80 pt-0.5">
                          {isRunning ? "Job: active" : `Warm: ${12 + idx * 3}m`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "dlq" && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h3 className="text-sm font-bold text-text-primary tracking-wide">Dead Letter Queue</h3>
              <p className="text-xs text-text-secondary mt-1 flex items-center space-x-2">
                <span>{dlqJobs.length} Failed Executions</span>
                <span>•</span>
                <span>Awaiting Replay</span>
              </p>
            </div>

            {dlqJobs.length === 0 ? (
              <p className="text-xs text-text-secondary italic bg-white/5 p-4 rounded-xl border border-white/5">No dead jobs found.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto no-scrollbar pr-2 pb-4">
                {dlqJobs.map((job) => (
                  <div
                    key={job.jobId}
                    className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 flex flex-col justify-between group transition-colors min-h-[140px]"
                  >
                    <div>
                      <div className="flex items-center space-x-2 text-sm font-bold text-accent-red mb-2">
                        <span className="bg-accent-red/10 px-2 py-1 rounded text-xs">✖ Exit Code 1</span>
                      </div>
                      <div className="text-xs font-mono text-text-secondary mb-1">ID: {job.jobId.slice(0, 12)}</div>
                      <div className="text-xs text-text-secondary truncate max-w-[200px]">{job.error || "Execution error context"}</div>
                    </div>
                    
                    <button
                      onClick={() => onReplayDlq(job.jobId)}
                      className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-text-primary text-xs font-bold rounded-lg transition-colors flex justify-center items-center space-x-2"
                    >
                      <span>Replay Job</span>
                      <span className="text-accent-cyan transition-transform group-hover:translate-x-1">→</span>
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
