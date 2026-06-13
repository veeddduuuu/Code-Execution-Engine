import { useEffect, useState, useRef, useReducer, type ReactNode } from "react";
import { useHealth } from "../lib/useHealth";
import { useJobStream } from "../lib/useJobStream";
import { useJobs } from "../lib/useJobs";
import { getHealthSummary } from "../types/api";
import { MonacoEditor, MonacoEditorRef } from "../components/editor/MonacoEditor";
import { executeCode, cancelJob, getDlq, replayDlq, getJobStatus } from "../lib/apiClient";
import { TerminalPanel, TerminalPanelRef } from "../components/terminal/TerminalPanel";
import { StatusStrip } from "../components/StatusStrip";
import { ArchitectureFlow } from "../components/ArchitectureFlow";
import { NodeInfoPanel } from "../components/NodeInfoPanel";
import { JobHistory } from "../components/JobHistory";
import { SystemFocusPanel } from "../components/SystemFocusPanel";
import { ExecutionTimeline } from "../components/ExecutionTimeline";

type ExecutionStatus = "idle" | "submitting" | "streaming" | "done" | "failed" | "cancelled";

interface State {
  status: ExecutionStatus;
  jobId: string;
}

type Action =
  | { type: "RUN_CLICKED" }
  | { type: "SUBMIT_SUCCESS"; payload: { jobId: string } }
  | { type: "SUBMIT_FAILURE"; payload: { error: string } }
  | { type: "STREAM_STARTED" }
  | { type: "DONE_RECEIVED"; payload: { success: boolean } }
  | { type: "CANCEL_CLICKED" }
  | { type: "CANCELLED_RECEIVED" }
  | { type: "SELECT_JOB"; payload: { jobId: string; status: ExecutionStatus } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RUN_CLICKED":
      return { ...state, status: "submitting", jobId: "" };
    case "SUBMIT_SUCCESS":
      return { ...state, status: "streaming", jobId: action.payload.jobId };
    case "SUBMIT_FAILURE":
      return { ...state, status: "failed" };
    case "STREAM_STARTED":
      return { ...state, status: "streaming" };
    case "DONE_RECEIVED":
      return { ...state, status: action.payload.success ? "done" : "failed" };
    case "CANCEL_CLICKED":
      return state;
    case "CANCELLED_RECEIVED":
      return { ...state, status: "cancelled" };
    case "SELECT_JOB":
      return { ...state, status: action.payload.status, jobId: action.payload.jobId };
    default:
      return state;
  }
}

export function WorkspacePage() {
  const { jobs, error: jobsError } = useJobs();
  const { health } = useHealth();
  
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [activeNode, setActiveNode] = useState<string>("browser");
  const [isNodeDrawerOpen, setIsNodeDrawerOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineJob, setTimelineJob] = useState<any | null>(null);
  const [dlqJobs, setDlqJobs] = useState<any[]>([]);

  const editorRef = useRef<MonacoEditorRef>(null);
  const terminalRef = useRef<TerminalPanelRef>(null);
  const lastWrittenRef = useRef<number>(0);
  const lastJobIdRef = useRef<string>("");
  const userSelectedRef = useRef(false);
  const pendingSubmissionRef = useRef<{ code: string; jobId: string } | null>(null);
  const logQueueRef = useRef<string[]>([]);
  const isWritingRef = useRef<boolean>(false);

  const [state, dispatch] = useReducer(reducer, { status: "idle", jobId: "" });

  const handleNodeClick = (nodeId: string) => {
    setActiveNode(nodeId);
    setIsNodeDrawerOpen(true);
  };

  // Fetch dead letter queue
  const fetchDlq = async () => {
    try {
      const dead = await getDlq();
      setDlqJobs(dead || []);
    } catch (err) {
      console.error("Failed to fetch DLQ:", err);
    }
  };

  useEffect(() => {
    fetchDlq();
    const interval = setInterval(fetchDlq, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRun = async (codeToRun?: string) => {
    const code = codeToRun ?? editorRef.current?.getValue();
    if (!code || !code.trim()) return;

    const jobId = crypto.randomUUID();
    pendingSubmissionRef.current = { code, jobId };

    dispatch({ type: "RUN_CLICKED" });
    terminalRef.current?.clear();
    lastWrittenRef.current = 0;

    userSelectedRef.current = true;
    setSelectedJobId(jobId);

    // Instantly switch timeline to the new pending job
    handleOpenTimeline({
      jobId,
      status: "pending",
      language: "javascript",
      createdAt: new Date().toISOString()
    });
  };

  const handleCancel = async () => {
    const jobId = selectedJobId || state.jobId;
    if (!jobId) return;

    dispatch({ type: "CANCEL_CLICKED" });

    try {
      await cancelJob(jobId);
    } catch (err: any) {
      console.error("Cancellation failed:", err);
      terminalRef.current?.writeError(`Cancellation failed: ${err.message}`);
    }
  };

  const handleSelectJob = (jobId: string) => {
    userSelectedRef.current = true;
    setSelectedJobId(jobId);
    const selectedJob = jobs.find((j) => j.jobId === jobId);
    if (selectedJob) {
      let nextStatus: ExecutionStatus = "idle";
      if (selectedJob.status === "completed") nextStatus = "done";
      else if (selectedJob.status === "failed") nextStatus = "failed";
      else if (selectedJob.status === "cancelled") nextStatus = "cancelled";
      else if (selectedJob.status === "running") nextStatus = "streaming";

      dispatch({ type: "SELECT_JOB", payload: { jobId, status: nextStatus } });
    }
  };

  const handleReRunJob = async (jobId: string) => {
    try {
      terminalRef.current?.clear();
      terminalRef.current?.writeInfo(`Recovering code for job ${jobId.slice(0, 8)}...`);
      const jobDetails = await getJobStatus(jobId);
      if (jobDetails && jobDetails.code) {
        editorRef.current?.setValue(jobDetails.code);
        handleRun(jobDetails.code);
      } else {
        terminalRef.current?.writeError("Could not retrieve source code for this job.");
      }
    } catch (err: any) {
      console.error("Failed to re-run job:", err);
      terminalRef.current?.writeError(`Re-run failed: ${err.message}`);
    }
  };

  const handleReplayDlq = async (jobId: string) => {
    try {
      terminalRef.current?.clear();
      terminalRef.current?.writeInfo(`Replaying dead letter job ${jobId.slice(0, 8)}...`);
      const response = await replayDlq(jobId);
      if (response?.jobId) {
        handleSelectJob(response.jobId);
        fetchDlq();
      }
    } catch (err: any) {
      console.error("Failed to replay DLQ job:", err);
      terminalRef.current?.writeError(`DLQ replay failed: ${err.message}`);
    }
  };

  // Sync historical selections
  useEffect(() => {
    if (jobs.length === 0) {
      return;
    }

    if (!selectedJobId && !userSelectedRef.current) {
      const defaultJobId = jobs[0].jobId;
      setSelectedJobId(defaultJobId);

      let nextStatus: ExecutionStatus = "idle";
      if (jobs[0].status === "completed") nextStatus = "done";
      else if (jobs[0].status === "failed") nextStatus = "failed";
      else if (jobs[0].status === "cancelled") nextStatus = "cancelled";
      else if (jobs[0].status === "running") nextStatus = "streaming";

      dispatch({ type: "SELECT_JOB", payload: { jobId: defaultJobId, status: nextStatus } });
      
      // Auto-load timeline for initial default job
      handleOpenTimeline(jobs[0]);
    }
  }, [jobs, selectedJobId]);

  const { logs, status: streamStatus, error: streamError, result, cancelled } = useJobStream(selectedJobId);

  // Sync logs and final execution states
  useEffect(() => {
    if (streamStatus === "open") {
      dispatch({ type: "STREAM_STARTED" });
    }
  }, [streamStatus]);

  useEffect(() => {
    const pendingSubmission = pendingSubmissionRef.current;
    if (!pendingSubmission) return;
    if (selectedJobId !== pendingSubmission.jobId) return;
    if (streamStatus !== "open") return;

    pendingSubmissionRef.current = null;

    const submitExecution = async () => {
      try {
        const response = await executeCode(pendingSubmission.code, "javascript", undefined, pendingSubmission.jobId);
        const responseJobId = response?.jobId;
        if (responseJobId) {
          dispatch({ type: "SUBMIT_SUCCESS", payload: { jobId: responseJobId } });
        } else {
          dispatch({ type: "SUBMIT_FAILURE", payload: { error: "No job ID returned" } });
          terminalRef.current?.writeError("API did not return a job ID.");
        }
      } catch (err: any) {
        dispatch({ type: "SUBMIT_FAILURE", payload: { error: err.message || "Failed to submit" } });
        terminalRef.current?.writeError(err.message || "Execution submission failed.");
      }
    };

    void submitExecution();
  }, [selectedJobId, streamStatus]);

  // Handle writing logs and results imperatively
  useEffect(() => {
    if (!selectedJobId) return;

    if (selectedJobId !== lastJobIdRef.current) {
      terminalRef.current?.clear();
      lastWrittenRef.current = 0;
      lastJobIdRef.current = selectedJobId;
      logQueueRef.current = [];
      isWritingRef.current = false;
    }

    if (logs.length > lastWrittenRef.current) {
      const newLogs = logs.slice(lastWrittenRef.current);
      lastWrittenRef.current = logs.length;
      logQueueRef.current.push(...newLogs);
      
      const processQueue = async () => {
        if (isWritingRef.current) return;
        isWritingRef.current = true;
        
        while (logQueueRef.current.length > 0) {
          const logChunk = logQueueRef.current.shift();
          if (logChunk) {
            terminalRef.current?.write(logChunk);
            await new Promise(r => setTimeout(r, 15));
          }
        }
        isWritingRef.current = false;
      };
      
      void processQueue();
    }
  }, [logs, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;

    if (result) {
      dispatch({ type: "DONE_RECEIVED", payload: { success: result.success } });
      terminalRef.current?.writeInfo(`Process exited with code ${result.exitCode}`);
      // Refresh timeline automatically on completion
      // We pass a stub object so getJobStatus can fetch the freshest data directly
      handleOpenTimeline({ jobId: selectedJobId, status: "completed" });
    } else if (cancelled) {
      dispatch({ type: "CANCELLED_RECEIVED" });
      terminalRef.current?.writeWarning(`Execution Cancelled: ${cancelled.message}`);
      handleOpenTimeline({ jobId: selectedJobId, status: "cancelled" });
    } else if (streamError) {
      dispatch({ type: "SUBMIT_FAILURE", payload: { error: streamError.message } });
      terminalRef.current?.writeError(streamError.message);
      handleOpenTimeline({ jobId: selectedJobId, status: "failed" });
    }
  }, [result, cancelled, streamError, selectedJobId]);

  // Load details to timeline drawer when clicked
  const handleOpenTimeline = async (j: any) => {
    setIsTimelineOpen(true);
    setTimelineJob(j); // Set immediately to prevent empty state
    try {
      const detailedJob = await getJobStatus(j.jobId);
      // Ensure we extract the job if it is nested inside a response wrapper
      let unwrapped = detailedJob.job || detailedJob;
      
      // Handle API/Stream race condition: If the stream told us it's completed/failed,
      // but the database read hasn't updated yet, enforce the stream's truth.
      if (j.status && (j.status === "completed" || j.status === "failed" || j.status === "cancelled")) {
        if (unwrapped.status === "running" || unwrapped.status === "pending") {
          unwrapped = {
            ...unwrapped,
            status: j.status,
            completedAt: unwrapped.completedAt || new Date().toISOString()
          };
        }
      }
      
      setTimelineJob(unwrapped);
    } catch (err) {
      console.error("Failed to fetch detailed job status for timeline", err);
    }
  };

  const healthSummary = health ? getHealthSummary(health) : null;

  return (
    <main className="mx-auto flex flex-col gap-6 px-6 pt-24 pb-12 max-w-7xl font-sans">
      {/* Top Banner Scrolling Ticker */}
      <StatusStrip health={health} jobs={jobs} />

      {/* Main Workspace Layout */}
      <section className="grid min-h-[calc(100vh-22rem)] gap-6 xl:grid-cols-[minmax(0,66fr)_minmax(22rem,34fr)]">
        {/* Left Workspace (Editor & Terminal) */}
        <div className="grid min-h-[38rem] gap-6 xl:grid-rows-[minmax(26rem,1fr)_14rem]">
          {/* Editor Panel */}
          <Panel
            className="bg-[var(--bg-glass)] backdrop-blur-xl border-white/5"
            title="Monaco Code Editor"
            headerAction={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 text-3xs font-mono font-bold rounded border border-status-failed bg-status-failed/10 hover:bg-status-failed/20 text-status-failed transition-colors"
                >
                  ✕ CANCEL
                </button>
                <button
                  onClick={() => handleRun()}
                  disabled={state.status === "submitting"}
                  className={`px-4 py-1 text-3xs font-mono font-bold rounded border transition-colors ${
                    state.status === "submitting" 
                      ? "bg-[linear-gradient(110deg,rgba(34,197,94,0.1),45%,rgba(34,197,94,0.3),55%,rgba(34,197,94,0.1))] bg-[length:200%_100%] animate-shimmer border-status-completed/30 text-status-completed" 
                      : "border-status-completed bg-status-completed/10 hover:bg-status-completed/20 text-status-completed"
                  }`}
                >
                  {state.status === "submitting" ? "⏳ QUEUED..." : "▶ RUN CODE"}
                </button>
              </div>
            }
          >
            <div className="h-full rounded-2xl border border-white/5 overflow-hidden shadow-inner">
              <MonacoEditor
                ref={editorRef}
                defaultCode={`// Code Execution Engine Sandbox\n// Write safe, standard Javascript here\n\nfunction runCode() {\n  return "Warming container... execution complete!";\n}\n\nconsole.log(runCode());`}
                onRun={handleRun}
              />
            </div>
          </Panel>

          {/* Terminal Panel */}
          <Panel className="bg-[var(--bg-glass)] backdrop-blur-xl border-white/5" title="Standard Emulated Console (stdout / stderr)">
            <TerminalPanel ref={terminalRef} />
          </Panel>
        </div>

        {/* Right Workspace (Live Execution Timeline) */}
        <div className="flex flex-col min-h-[38rem]">
          <Panel 
            className="bg-[var(--bg-glass)] backdrop-blur-xl border-white/5 flex-1 shadow-2xl relative overflow-hidden" 
            title={
              <span className="flex items-center gap-2 text-accent-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                <span className="h-2 w-2 rounded-full bg-accent-cyan shadow-[0_0_6px_var(--accent-cyan)]" />
                Live Execution Trace
              </span>
            }
          >
            <div className="absolute inset-0 bg-gradient-to-b from-accent-cyan/5 to-transparent pointer-events-none" />
            <div className="relative z-10 h-full">
              <ExecutionTimeline
                job={timelineJob}
                isOpen={true}
                onClose={() => {}}
              />
            </div>
          </Panel>
        </div>
      </section>

      {/* Bottom Subsystem Dashboard Tabs */}
      <SystemFocusPanel
        health={health}
        dlqJobs={dlqJobs}
        onReplayDlq={handleReplayDlq}
      />

      {/* Job History Scrolling Card Deck */}
      <section className="rounded-3xl border border-white/5 bg-[var(--bg-glass)] backdrop-blur-xl p-6 shadow-2xl">
        {jobsError && (
          <p className="text-xs text-accent-red font-mono mb-2">History Fetch Error: {jobsError.message}</p>
        )}
        <JobHistory
          jobs={jobs}
          selectedJobId={selectedJobId}
          onSelectJob={handleSelectJob}
          onReRunJob={handleReRunJob}
          onViewTimeline={handleOpenTimeline}
        />
      </section>

      {/* Floating Node Info Drawer */}
      <NodeInfoPanel
        nodeId={activeNode}
        isOpen={isNodeDrawerOpen}
        onClose={() => setIsNodeDrawerOpen(false)}
        healthData={health}
      />
    </main>
  );
}

type PanelProps = {
  children?: ReactNode;
  className: string;
  title: string;
  headerAction?: ReactNode;
};

function Panel({ children, className, title, headerAction }: PanelProps) {
  return (
    <section className={`relative rounded-3xl border border-border-strong p-5 ${className} shadow-2xl h-full flex flex-col transition-all`}>
      <div className="flex items-center justify-between mb-4 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-white/20" />
          <p className="text-xs font-semibold text-text-primary tracking-wide">{title}</p>
        </div>
        {headerAction}
      </div>
      <div className="relative flex-grow h-0">
        {children}
      </div>
    </section>
  );
}
