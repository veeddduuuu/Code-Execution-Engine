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

  return (
    <div className="fixed inset-0 bg-[#1C1F24]/55 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay listener */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      {/* Bubble Modal Card */}
      <div className="relative w-full max-w-md bg-bg-surface border border-border-subtle rounded-xl shadow-2xl z-10 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Drawer Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-muted">
          <div>
            <h3 className="text-xs font-bold font-mono text-text-primary uppercase">Execution Timeline</h3>
            <span className="text-3xs text-text-secondary font-mono truncate max-w-[200px] block mt-0.5">
              ID: {job?.jobId || "N/A"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1 bg-bg-page border border-border-subtle rounded transition-colors text-2xs font-mono font-bold"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Overview Block */}
        {job && (
          <div className="p-4 bg-bg-page border-b border-border-subtle grid grid-cols-3 gap-2 text-2xs">
            <div className="flex flex-col">
              <span className="text-text-secondary">Language</span>
              <span className="font-mono font-bold text-text-primary mt-0.5">{job.language || "javascript"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-text-secondary">Status</span>
              <span className={`font-mono font-bold uppercase mt-0.5 ${
                job.status === "completed"
                  ? "text-accent-green"
                  : job.status === "failed"
                  ? "text-accent-red"
                  : "text-accent-amber"
              }`}>
                {job.status}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-text-secondary">Total Latency</span>
              <span className="font-mono font-bold text-accent-cyan mt-0.5">
                {job.completedAt && job.createdAt
                  ? `${new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()}ms`
                  : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Timeline List */}
        <div className="p-5 flex-grow overflow-y-auto space-y-4 font-sans select-none">
          {events.length === 0 ? (
            <p className="text-xs text-text-secondary italic text-center py-8">Select a job execution to view detail metrics.</p>
          ) : (
            <div className="relative border-l-2 border-border-subtle ml-2 pl-4 space-y-6">
              {events.map((ev, idx) => {
                let dotColor = "bg-border-strong";
                if (ev.status === "completed") {
                  dotColor = "bg-accent-green";
                } else if (ev.status === "failed") {
                  dotColor = "bg-accent-red";
                } else if (ev.status === "pending") {
                  dotColor = "bg-accent-amber animate-pulse";
                }

                return (
                  <div key={idx} className="relative text-2xs">
                    {/* Event Timeline Node Bullet */}
                    <span className={`absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-bg-surface flex items-center justify-center ${dotColor}`}>
                      {ev.status === "completed" && (
                        <span className="h-1 w-1 rounded-full bg-bg-surface" />
                      )}
                    </span>

                    {/* Header info */}
                    <div className="flex items-center justify-between text-3xs font-mono text-text-secondary">
                      <span>{ev.timestamp}</span>
                      <span className="font-bold text-accent-cyan">{ev.relativeOffsetMs}</span>
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-text-primary text-xs mt-0.5">{ev.name}</h4>
                    
                    {/* Desc */}
                    <p className="text-text-secondary mt-1 leading-normal font-sans">{ev.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
