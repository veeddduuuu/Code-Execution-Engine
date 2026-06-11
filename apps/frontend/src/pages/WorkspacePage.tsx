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

    dispatch({ type: "RUN_CLICKED" });
    terminalRef.current?.clear();
    lastWrittenRef.current = 0;

    try {
      const response = await executeCode(code, "javascript");
      const jobId = response?.jobId;
      if (jobId) {
        dispatch({ type: "SUBMIT_SUCCESS", payload: { jobId } });
        setSelectedJobId(jobId);
      } else {
        dispatch({ type: "SUBMIT_FAILURE", payload: { error: "No job ID returned" } });
        terminalRef.current?.writeError("API did not return a job ID.");
      }
    } catch (err: any) {
      dispatch({ type: "SUBMIT_FAILURE", payload: { error: err.message || "Failed to submit" } });
      terminalRef.current?.writeError(err.message || "Execution submission failed.");
    }
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

    if (!selectedJobId) {
      const defaultJobId = jobs[0].jobId;
      setSelectedJobId(defaultJobId);

      let nextStatus: ExecutionStatus = "idle";
      if (jobs[0].status === "completed") nextStatus = "done";
      else if (jobs[0].status === "failed") nextStatus = "failed";
      else if (jobs[0].status === "cancelled") nextStatus = "cancelled";
      else if (jobs[0].status === "running") nextStatus = "streaming";

      dispatch({ type: "SELECT_JOB", payload: { jobId: defaultJobId, status: nextStatus } });
    }
  }, [jobs, selectedJobId]);

  const { logs, status: streamStatus, error: streamError, result, cancelled } = useJobStream(selectedJobId);

  // Sync logs and final execution states
  useEffect(() => {
    if (streamStatus === "open") {
      dispatch({ type: "STREAM_STARTED" });
    }
  }, [streamStatus]);

  // Handle writing logs and results imperatively
  useEffect(() => {
    if (!selectedJobId) return;

    if (selectedJobId !== lastJobIdRef.current) {
      terminalRef.current?.clear();
      lastWrittenRef.current = 0;
      lastJobIdRef.current = selectedJobId;
    }

    if (logs.length > lastWrittenRef.current) {
      for (let i = lastWrittenRef.current; i < logs.length; i++) {
        terminalRef.current?.write(logs[i]);
      }
      lastWrittenRef.current = logs.length;
    }
  }, [logs, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;

    if (result) {
      dispatch({ type: "DONE_RECEIVED", payload: { success: result.success } });
      terminalRef.current?.writeInfo(`Process exited with code ${result.exitCode}`);
    } else if (cancelled) {
      dispatch({ type: "CANCELLED_RECEIVED" });
      terminalRef.current?.writeWarning(`Execution Cancelled: ${cancelled.message}`);
    } else if (streamError) {
      dispatch({ type: "SUBMIT_FAILURE", payload: { error: streamError.message } });
      terminalRef.current?.writeError(streamError.message);
    }
  }, [result, cancelled, streamError, selectedJobId]);

  // Load details to timeline drawer when clicked
  const handleOpenTimeline = async (j: any) => {
    try {
      const detailedJob = await getJobStatus(j.jobId);
      setTimelineJob(detailedJob);
      setIsTimelineOpen(true);
    } catch (err) {
      setTimelineJob(j);
      setIsTimelineOpen(true);
    }
  };

  const healthSummary = health ? getHealthSummary(health) : null;
  const metrics = healthSummary
    ? [
        { label: "Warm Pool", value: `${healthSummary.poolAvailable} available` },
        { label: "Queue Depth", value: String(healthSummary.queueDepth) },
        { label: "Workers", value: `${healthSummary.workerCount} active` },
        { label: "System Status", value: healthSummary.status.toUpperCase() },
      ]
    : [
        { label: "Warm Pool", value: "—" },
        { label: "Queue Depth", value: "—" },
        { label: "Workers", value: "—" },
        { label: "System Status", value: "OFFLINE" },
      ];

  return (
    <main className="mx-auto flex flex-col gap-4 px-4 py-4 max-w-7xl font-sans">
      {/* Top Banner Scrolling Ticker */}
      <StatusStrip health={health} jobs={jobs} />

      {/* Main Workspace Layout */}
      <section className="grid min-h-[calc(100vh-22rem)] gap-4 xl:grid-cols-[minmax(0,66fr)_minmax(22rem,34fr)]">
        {/* Left Workspace (Editor & Terminal) */}
        <div className="grid min-h-[38rem] gap-4 xl:grid-rows-[minmax(26rem,1fr)_14rem]">
          {/* Editor Panel */}
          <Panel
            className="bg-bg-card"
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
                  className="px-4 py-1 text-3xs font-mono font-bold rounded border border-status-completed bg-status-completed/10 hover:bg-status-completed/20 text-status-completed transition-colors"
                >
                  ▶ RUN CODE
                </button>
              </div>
            }
          >
            <div className="h-full rounded border border-border-subtle overflow-hidden">
              <MonacoEditor
                ref={editorRef}
                defaultCode={`// Code Execution Engine Sandbox\n// Write safe, standard Javascript here\n\nfunction runCode() {\n  return "Warming container... execution complete!";\n}\n\nconsole.log(runCode());`}
                onRun={handleRun}
              />
            </div>
          </Panel>

          {/* Terminal Panel */}
          <Panel className="bg-bg-card" title="Standard Emulated Console (stdout / stderr)">
            <TerminalPanel ref={terminalRef} />
          </Panel>
        </div>

        {/* Right Workspace (Architecture Flow & Live Metrics) */}
        <div className="flex flex-col gap-4">
          {/* Interactive SVG Diagram */}
          <div className="flex-grow">
            <ArchitectureFlow
              selectedNode={activeNode}
              onSelectNode={handleNodeClick}
              activeStatus={state.status}
            />
          </div>

          {/* Action button and live subsystem metrics */}
          <div className="bg-bg-card p-4 rounded border border-border-subtle shadow-sm space-y-3 shrink-0">
            <button
              onClick={() => {
                const currentJob = jobs.find((j) => j.jobId === selectedJobId);
                if (currentJob) handleOpenTimeline(currentJob);
              }}
              disabled={!selectedJobId}
              className="w-full py-2 text-xs font-mono font-bold rounded bg-bg-inverse text-text-inverse hover:bg-bg-inverse/85 transition-colors disabled:opacity-50"
            >
              ⚡ OPEN EXECUTION TIMELINE DRAWER
            </button>
            <div className="grid grid-cols-2 gap-2">
              {metrics.map((metric) => (
                <div key={metric.label} className="p-2 bg-bg-page border border-border-subtle rounded flex flex-col justify-center">
                  <span className="text-4xs uppercase font-bold text-text-secondary tracking-wider">{metric.label}</span>
                  <span className="text-xs font-bold font-mono text-text-primary mt-0.5">{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Subsystem Dashboard Tabs */}
      <SystemFocusPanel
        health={health}
        dlqJobs={dlqJobs}
        onReplayDlq={handleReplayDlq}
      />

      {/* Job History Scrolling Card Deck */}
      <section className="rounded border border-border-subtle bg-bg-card p-4 shadow-sm">
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

      {/* Floating Timeline Drawer */}
      <ExecutionTimeline
        job={timelineJob}
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
      />

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
    <section className={`relative rounded border border-border-subtle p-4 ${className} shadow-2xs h-full flex flex-col`}>
      <div className="flex items-center justify-between mb-2 border-b border-border-subtle pb-1 shrink-0">
        <p className="text-3xs uppercase font-bold text-text-secondary tracking-wider font-mono">{title}</p>
        {headerAction}
      </div>
      <div className="relative flex-grow h-0">
        {children}
      </div>
    </section>
  );
}
