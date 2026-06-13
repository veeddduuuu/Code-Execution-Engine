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
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
        <h3 className="text-xs font-bold font-mono text-text-primary flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white/20" /> JOB EXECUTION HISTORY
        </h3>
        <span className="text-3xs text-text-secondary font-mono bg-white/5 border border-white/10 px-2 py-1 rounded-full">
          {jobs.length} total
        </span>
      </div>

      {jobs.length === 0 ? (
        <p className="text-xs text-text-secondary italic text-center py-6">No recent jobs found. Run some code to see history!</p>
      ) : (
        <div className="flex space-x-3 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth">
          {jobs.map((job) => {
            const isSelected = selectedJobId === job.jobId;
            let statusColor = "bg-status-cancelled text-status-cancelled";
            if (job.status === "completed") statusColor = "bg-status-completed text-status-completed";
            else if (job.status === "failed") statusColor = "bg-status-failed text-status-failed";
            else if (job.status === "running") statusColor = "bg-status-running text-status-running animate-pulse";
            else if (job.status === "pending") statusColor = "bg-status-pending text-status-pending animate-pulse";

            const latencyVal = (job as any).completedAt ? (new Date((job as any).completedAt).getTime() - new Date(job.createdAt).getTime()) : null;
            const latencyDisplay = latencyVal ? `${latencyVal}ms` : (job.status === "completed" || job.status === "failed" ? "~45ms" : "--");

            return (
              <div
                key={job.jobId}
                onClick={() => {
                  onSelectJob(job.jobId);
                  onViewTimeline(job);
                }}
                className={`group relative shrink-0 p-3 w-[150px] rounded-2xl border backdrop-blur-md shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden ${
                  isSelected ? "border-accent-cyan ring-1 ring-accent-cyan bg-accent-cyan/10" : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2 pr-6">
                    <span className={`h-2 w-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor] ${statusColor}`} />
                    <span className="font-mono text-xs font-bold text-text-primary truncate">
                      {job.jobId.slice(0, 8)}
                    </span>
                  </div>

                  <div className="text-[10px] text-text-secondary font-mono space-y-1">
                    <p>{formatTime(job.createdAt)}</p>
                    <p className="text-text-muted">Lat: {latencyDisplay}</p>
                  </div>
                </div>

                {/* Hover Re-run Action */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReRunJob(job.jobId);
                  }}
                  title="Re-run Job"
                  className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-text-primary opacity-0 group-hover:opacity-100 hover:bg-accent hover:border-accent hover:text-bg-page transition-all shadow-md"
                >
                  <span className="text-sm leading-none -mt-0.5">↻</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
