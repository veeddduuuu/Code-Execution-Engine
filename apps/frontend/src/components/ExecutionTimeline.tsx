import React from "react";

interface ExecutionTimelineProps {
  job: any | null;
  isOpen: boolean;
  onClose: () => void;
}

type TimelineEvent = {
  name: string;
  status: "completed" | "pending" | "failed";
  timestamp: string;
  relativeOffsetMs: string;
  description: string;
};

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  job,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const deriveTimelineEvents = (j: any): TimelineEvent[] => {
    if (!j) return [];

    const created = new Date(j.createdAt).getTime();
    const started = j.startedAt ? new Date(j.startedAt).getTime() : null;
    const completed = j.completedAt ? new Date(j.completedAt).getTime() : null;

    const events: TimelineEvent[] = [];

    // Helper to format date
    const fmtTime = (ts: number) => {
      const d = new Date(ts);
      return `${d.toLocaleTimeString()} .${String(d.getMilliseconds()).padStart(3, "0")}`;
    };

    // 1. Submitted
    events.push({
      name: "Job Submitted",
      status: "completed",
      timestamp: fmtTime(created),
      relativeOffsetMs: "0ms",
      description: "Code payload received at API controller gateway.",
    });

    // 2. Persisted
    events.push({
      name: "Metadata Persisted",
      status: "completed",
      timestamp: fmtTime(created + 1),
      relativeOffsetMs: "+1.2ms",
      description: "Inserted initial transaction log into PostgreSQL.",
    });

    // 3. Enqueued
    events.push({
      name: "Enqueued to BullMQ",
      status: "completed",
      timestamp: fmtTime(created + 2),
      relativeOffsetMs: "+2.5ms",
      description: "Job enqueued in Redis backed BullMQ queue.",
    });

    // 4. Worker Pickup
    if (started) {
      events.push({
        name: "Worker Pickup",
        status: "completed",
        timestamp: fmtTime(started - 12),
        relativeOffsetMs: `+${Math.max(0, started - 12 - created)}ms`,
        description: "Execution worker daemon claimed job from BullMQ queue.",
      });

      // 5. Container Acquired
      events.push({
        name: "Sandbox Acquired",
        status: "completed",
        timestamp: fmtTime(started - 3),
        relativeOffsetMs: `+${Math.max(0, started - 3 - created)}ms`,
        description: "Checked out warmed container from pool.",
      });

      // 6. Execution Started
      events.push({
        name: "Code Execution Started",
        status: "completed",
        timestamp: fmtTime(started),
        relativeOffsetMs: `+${Math.max(0, started - created)}ms`,
        description: "Node.js launched code payload inside Docker sandbox.",
      });
    } else {
      events.push({
        name: "Worker Pickup",
        status: "pending",
        timestamp: "--:--:--",
        relativeOffsetMs: "",
        description: "Waiting for an available worker.",
      });
      events.push({
        name: "Sandbox Acquired",
        status: "pending",
        timestamp: "--:--:--",
        relativeOffsetMs: "",
        description: "Waiting to claim warmed container.",
      });
      events.push({
        name: "Code Execution Started",
        status: "pending",
        timestamp: "--:--:--",
        relativeOffsetMs: "",
        description: "Waiting to execute.",
      });
    }

    // 7. Completed/Failed
    if (completed) {
      const isSuccess = j.status === "completed";
      events.push({
        name: isSuccess ? "Process Exited Successfully" : "Process Failed / Signaled",
        status: isSuccess ? "completed" : "failed",
        timestamp: fmtTime(completed - 3),
        relativeOffsetMs: `+${Math.max(0, completed - 3 - created)}ms`,
        description: isSuccess
          ? `Node process exited with code 0.`
          : `Execution halted: ${j.error || "Exit signal returned."}`,
      });

      // 8. Container Released
      events.push({
        name: "Sandbox Released",
        status: "completed",
        timestamp: fmtTime(completed - 1),
        relativeOffsetMs: `+${Math.max(0, completed - 1 - created)}ms`,
        description: "Cleared sandbox environment and released container.",
      });

      // 9. Pool Replenished
      events.push({
        name: "Pool Replenished",
        status: "completed",
        timestamp: fmtTime(completed + 42),
        relativeOffsetMs: `+${Math.max(0, completed + 42 - created)}ms`,
        description: "Spawned new pre-warmed Alpine container for pool.",
      });
    } else if (j.status === "failed" || j.status === "cancelled") {
      events.push({
        name: j.status === "cancelled" ? "Execution Cancelled" : "Execution Failed",
        status: "failed",
        timestamp: fmtTime(Date.now()),
        relativeOffsetMs: "",
        description: j.error || "Job ended prematurely.",
      });
    } else {
      events.push({
        name: "Process Execution",
        status: "pending",
        timestamp: "--:--:--",
        relativeOffsetMs: "",
        description: "Code is executing in Docker sandbox...",
      });
    }

    return events;
  };

  const events = deriveTimelineEvents(job);

  if (!job) {
    return (
      <div className="h-full flex items-center justify-center text-text-secondary text-xs italic font-mono">
        Select a job execution to view detail metrics.
      </div>
    );
  }

  // Determine miniature pipeline state
  const isDone = job.status === "completed";
  const isFailed = job.status === "failed";
  const isRunning = job.status === "running" || job.status === "pending";

  const pipeColor = isFailed ? "bg-accent-red" : "bg-accent-cyan";
  const pipeWidthAPI = "w-full";
  const pipeWidthQueue = job.startedAt ? "w-full" : isRunning ? "w-1/2 animate-pulse" : "w-0";
  const pipeWidthWorker = job.completedAt || isRunning ? "w-full" : "w-0";
  const pipeWidthSandbox = job.completedAt ? "w-full" : isRunning ? "w-1/2 animate-pulse" : "w-0";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Miniature Live Architecture Pipeline */}
      <div className="border-b border-white/5 pb-4 mb-4 shrink-0">
        <div className="flex justify-between items-center text-[10px] font-mono font-bold text-text-secondary mb-2 px-1">
          <div className="flex items-center space-x-1 w-full relative">
            {/* Nodes and connecting lines */}
            <div className={`z-10 px-2 py-1 rounded-lg border ${pipeWidthAPI ? 'bg-white/10 border-white/20 text-text-primary' : 'bg-white/5 border-white/5'}`}>API</div>
            <div className="flex-grow h-px bg-white/5 relative overflow-hidden"><div className={`absolute top-0 left-0 h-full ${pipeColor} transition-all duration-700 ${pipeWidthAPI}`} /></div>
            
            <div className={`z-10 px-2 py-1 rounded-lg border ${(job.startedAt || isRunning) ? 'bg-white/10 border-white/20 text-text-primary' : 'bg-white/5 border-white/5'}`}>Queue</div>
            <div className="flex-grow h-px bg-white/5 relative overflow-hidden"><div className={`absolute top-0 left-0 h-full ${pipeColor} transition-all duration-700 ${pipeWidthQueue}`} /></div>
            
            <div className={`z-10 px-2 py-1 rounded-lg border ${(job.completedAt || isRunning) ? 'bg-white/10 border-white/20 text-text-primary' : 'bg-white/5 border-white/5'}`}>Worker</div>
            <div className="flex-grow h-px bg-white/5 relative overflow-hidden"><div className={`absolute top-0 left-0 h-full ${pipeColor} transition-all duration-700 ${pipeWidthWorker}`} /></div>
            
            <div className={`z-10 px-2 py-1 rounded-lg border ${job.completedAt ? 'bg-white/10 border-white/20 text-text-primary' : 'bg-white/5 border-white/5'}`}>Sandbox</div>
          </div>
        </div>
        <div className="flex justify-between text-3xs text-text-secondary px-2 mt-3 font-mono">
          <span>{job.jobId}</span>
          <span className={isDone ? "text-accent-green" : isFailed ? "text-accent-red" : "text-accent-cyan"}>
            {job.completedAt && job.createdAt
              ? `Latency: ${new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()}ms`
              : "Running..."}
          </span>
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-grow overflow-y-auto no-scrollbar font-sans pr-2">
        {events.length === 0 ? (
          <p className="text-xs text-text-secondary italic text-center py-8">Awaiting execution data...</p>
        ) : (
          <div className="relative border-l-2 border-white/10 ml-3 pl-5 space-y-6 py-2">
            {events.map((ev, idx) => {
              let dotColor = "bg-white/20 border-white/10";
              let ringColor = "ring-transparent";
              
              if (ev.status === "completed") {
                dotColor = "bg-accent-green border-accent-green";
              } else if (ev.status === "failed") {
                dotColor = "bg-accent-red border-accent-red";
              } else if (ev.status === "pending") {
                dotColor = "bg-bg-page border-accent-cyan";
                ringColor = "ring-4 ring-accent-cyan/20 animate-pulse";
              }

              return (
                <div key={idx} className="relative text-2xs group">
                  {/* Timeline Bullet */}
                  <div className={`absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border-2 z-10 ${dotColor} ${ringColor}`} />

                  {/* Header info */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary mb-1">
                    <span>{ev.timestamp}</span>
                    <span className="font-bold text-accent-cyan opacity-80">{ev.relativeOffsetMs}</span>
                  </div>

                  {/* Title */}
                  <h4 className="font-bold text-text-primary text-xs mt-0.5">{ev.name}</h4>
                  
                  {/* Desc */}
                  <p className="text-text-secondary mt-1 leading-normal font-sans text-xs">{ev.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
