import React from "react";
import { Job } from "../types/api";

interface JobHistoryProps {
  jobs: Job[];
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  onReRunJob: (jobId: string) => void;
  onViewTimeline: (job: Job) => void;
}

export const JobHistory: React.FC<JobHistoryProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  onReRunJob,
  onViewTimeline,
}) => {
  // Format creation time
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "00:00:00";
    }
  };

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border-subtle">
        <h3 className="text-xs font-bold font-mono text-text-primary uppercase flex items-center gap-1.5">
          <span>📋</span> Job Execution History (Last 100 Runs)
        </h3>
        <span className="text-3xs text-text-secondary font-mono bg-bg-page border border-border-subtle px-1.5 py-0.5 rounded">
          {jobs.length} total
        </span>
      </div>

      {jobs.length === 0 ? (
        <p className="text-xs text-text-secondary italic text-center py-6">No recent jobs found. Run some code to see history!</p>
      ) : (
        <div className="flex space-x-3 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth">
          {jobs.map((job) => {
            const isSelected = selectedJobId === job.jobId;
            let statusBadge = "bg-[#888780]/15 text-[#888780] border-[#888780]/30";
            if (job.status === "completed") {
              statusBadge = "bg-status-completed/10 text-status-completed border-status-completed/30";
            } else if (job.status === "failed") {
              statusBadge = "bg-status-failed/10 text-status-failed border-status-failed/30";
            } else if (job.status === "running") {
              statusBadge = "bg-status-running/10 text-status-running border-status-running/30 animate-pulse";
            } else if (job.status === "pending") {
              statusBadge = "bg-status-pending/10 text-status-pending border-status-pending/30 animate-pulse";
            }

            return (
              <div
                key={job.jobId}
                onClick={() => onSelectJob(job.jobId)}
                className={`min-w-[190px] max-w-[200px] shrink-0 p-3 rounded border bg-bg-surface shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isSelected ? "border-accent ring-1 ring-accent" : "border-border-subtle"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs font-bold text-text-primary">
                      id-{job.jobId.slice(0, 8)}
                    </span>
                    <span className={`text-3xs px-1.5 py-0.5 rounded border font-mono font-semibold uppercase tracking-wider ${statusBadge}`}>
                      {job.status}
                    </span>
                  </div>

                  <p className="text-3xs text-text-secondary font-mono mb-3">
                    Ran at: {formatTime(job.createdAt)}
                  </p>
                </div>

                <div className="flex items-center space-x-2 mt-1">
                  {/* View logs / select */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectJob(job.jobId);
                    }}
                    className="flex-1 py-1 text-4xs font-mono font-bold uppercase tracking-wider rounded border border-border-subtle bg-bg-page hover:bg-bg-elevated text-text-primary transition-colors text-center"
                  >
                    Logs
                  </button>
                  
                  {/* Re-run */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReRunJob(job.jobId);
                    }}
                    title="Reload code into editor and execute"
                    className="p-1 px-2 text-4xs font-mono font-bold uppercase tracking-wider rounded bg-accent hover:bg-accent/80 text-text-inverse transition-colors"
                  >
                    ▶ Re-run
                  </button>

                  {/* View timeline */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewTimeline(job);
                    }}
                    title="View precise execution intervals"
                    className="p-1 px-1.5 text-4xs font-mono font-bold rounded border border-border-subtle bg-bg-page hover:bg-bg-elevated text-text-secondary transition-colors"
                  >
                    ⚡
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
