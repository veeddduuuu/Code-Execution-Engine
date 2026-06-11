import React from "react";
import { HealthResponse } from "../types/api";

interface NodeInfoDrawerProps {
  nodeId: string;
  isOpen: boolean;
  onClose: () => void;
  healthData: HealthResponse | null;
}

export const NodeInfoPanel: React.FC<NodeInfoDrawerProps> = ({
  nodeId,
  isOpen,
  onClose,
  healthData,
}) => {
  if (!isOpen) return null;

  // Static information maps
  const infoMap: Record<
    string,
    {
      title: string;
      role: string;
      what: string;
      why: string;
      tech: string[];
    }
  > = {
    browser: {
      title: "Client Workspace (Browser)",
      role: "User Interface & Input Capture",
      what: "A rich client application rendering a high-performance Monaco Editor, standard xterm console emulation, and interactive node diagrams.",
      why: "Allows engineers to write code, submit tasks, monitor run metadata, and stream stdout/stderr buffers without page refreshes.",
      tech: ["React 18", "Monaco Editor", "xterm.js", "Vite", "Tailwind CSS"],
    },
    api: {
      title: "API Gateway (Express)",
      role: "Orchestration & Ingestion",
      what: "The entry point for incoming submissions. Handles routing, rate-limiting (Token Bucket), authentication, database logs, and WebSocket subscriptions.",
      why: "Ensures the backend remains resilient. Decouples client connections from heavy container operations using non-blocking I/O.",
      tech: ["Node.js", "Express", "Helmet", "CORS", "ws (WebSocket)"],
    },
    queue: {
      title: "BullMQ Queue (Redis)",
      role: "Job Orchestration & Load Balancing",
      what: "A distributed job queue backed by Redis. Holds pending submissions, distributes them to workers, and tracks retries and backoffs.",
      why: "Smoothes out sudden traffic spikes, manages backpressure, and guarantees job persistence even if worker processes fail.",
      tech: ["BullMQ", "Redis 7", "In-Memory Queues"],
    },
    worker: {
      title: "Executor Worker",
      role: "Resource Consumer & Sandbox Driver",
      what: "A multi-threaded daemon that pops jobs from the queue, claims sandbox containers, mounts code files, and monitors system resource limits.",
      why: "Keeps script execution off the main web server. Directs stderr/stdout to Redis Pub/Sub channels for real-time streaming.",
      tech: ["TypeScript", "Dockerode", "BullMQ Worker", "Node.js Streams"],
    },
    docker: {
      title: "Docker Sandbox Pool",
      role: "Hostile Code Containment",
      what: "A pool of isolated, non-networked Docker containers running non-root users and read-only filesystems. Keeps pre-warmed engines ready for instant booting.",
      why: "Protects the host OS against hostile submissions (arbitrary filesystem writes, network spamming, infinite forks) with minimal start latency (<10ms).",
      tech: ["Docker API", "Alpine Node-22", "Linux cgroups"],
    },
    db: {
      title: "PostgreSQL Database",
      role: "Persistent Audit Trail & Storage",
      what: "The relational database storing execution records, run details, errors, output summaries, and client idempotency keys.",
      why: "Provides historical trace audits of all code runs, supports re-run retrieval, and prevents double-submits via transaction locks.",
      tech: ["PostgreSQL 16", "node-pg Pool", "SQL Transactions"],
    },
  };

  const selectedInfo = infoMap[nodeId] || infoMap.browser;

  // Extract live metrics if healthData exists
  const getMetrics = () => {
    if (!healthData) return <p className="text-xs text-text-secondary italic">No operational metrics available (backend offline).</p>;

    const findDep = (name: string) => healthData.dependencies.find((d) => d.name === name);
    const dbDep = findDep("postgres");
    const redisDep = findDep("redis");
    const queueDep = findDep("executionQueue");
    const workerDep = findDep("worker");

    switch (nodeId) {
      case "browser":
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Web Client State</span>
              <p className="font-mono text-accent-green font-bold">Online</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">API Ping Latency</span>
              <p className="font-mono text-text-primary">{healthData.latencyMs ? `${healthData.latencyMs}ms` : "N/A"}</p>
            </div>
          </div>
        );
      case "api":
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Gateway State</span>
              <p className={`font-mono font-bold ${healthData.status === "healthy" ? "text-accent-green" : "text-accent-amber"}`}>
                {healthData.status.toUpperCase()}
              </p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Process PID</span>
              <p className="font-mono text-text-primary">{healthData.service?.pid || "N/A"}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle col-span-2">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Node Instance</span>
              <p className="font-mono text-text-primary text-2xs truncate">{healthData.service?.node || "N/A"}</p>
            </div>
          </div>
        );
      case "queue": {
        const queueMeta = queueDep?.meta as any;
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Queue Depth</span>
              <p className="font-mono text-text-primary text-lg font-bold">{queueMeta?.queueDepth ?? 0}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">DLQ Failures</span>
              <p className={`font-mono text-lg font-bold ${queueMeta?.dlqDepth > 0 ? "text-accent-red" : "text-text-primary"}`}>
                {queueMeta?.dlqDepth ?? 0}
              </p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Active Jobs</span>
              <p className="font-mono text-text-primary font-bold">{queueMeta?.activeJobs ?? 0}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Redis Ping</span>
              <p className="font-mono text-accent-green font-bold">{redisDep?.latencyMs ? `${redisDep.latencyMs}ms` : "OK"}</p>
            </div>
          </div>
        );
      }
      case "worker": {
        const workerMeta = workerDep?.meta as any;
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Worker Instances</span>
              <p className="font-mono text-text-primary text-lg font-bold">{workerMeta?.workers?.count ?? 0}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Running Jobs</span>
              <p className="font-mono text-text-primary text-lg font-bold">{workerMeta?.queue?.activeJobs ?? 0}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle col-span-2">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Worker State</span>
              <p className="font-mono text-text-primary text-2xs truncate">
                {workerDep?.state === "connected" ? "Listening to BullMQ 'execution' queue" : "Disconnected"}
              </p>
            </div>
          </div>
        );
      }
      case "docker": {
        const workerMeta = workerDep?.meta as any;
        const pool = workerMeta?.containerPool;
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Warmed Pool Size</span>
              <p className="font-mono text-accent-green text-lg font-bold">{pool?.available ?? 0}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Total Containers</span>
              <p className="font-mono text-text-primary text-lg font-bold">{(pool?.available ?? 0) + (pool?.active ?? 0)}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Active Allocations</span>
              <p className="font-mono text-text-primary font-bold">{pool?.active ?? 0}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Pool State</span>
              <p className={`font-mono font-bold ${pool?.warming ? "text-accent-amber" : "text-accent-green"}`}>
                {pool?.warming ? "Warming" : "Ready"}
              </p>
            </div>
          </div>
        );
      }
      case "db":
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">DB Health</span>
              <p className="font-mono text-accent-green font-bold">{dbDep?.state === "connected" ? "Connected" : "Offline"}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Query Latency</span>
              <p className="font-mono text-text-primary">{dbDep?.latencyMs ? `${dbDep.latencyMs}ms` : "N/A"}</p>
            </div>
            <div className="p-2 bg-bg-page rounded border border-border-subtle col-span-2">
              <span className="text-2xs text-text-secondary uppercase font-semibold">Storage URL</span>
              <p className="font-mono text-text-primary text-2xs truncate font-semibold">Postgres (ep-broad-union...)</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1C1F24]/55 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay listener */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      {/* Bubble Modal Card */}
      <div className="relative w-full max-w-md bg-bg-surface border border-border-subtle rounded-xl shadow-2xl z-10 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-muted">
          <div>
            <span className="text-3xs uppercase tracking-wider font-semibold text-text-muted">{selectedInfo.role}</span>
            <h3 className="text-xs font-bold font-mono text-text-primary uppercase truncate max-w-[240px] block mt-0.5">
              {selectedInfo.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1 bg-bg-page border border-border-subtle rounded transition-colors text-2xs font-mono font-bold"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-grow overflow-y-auto space-y-4 font-sans select-none">
          <div>
            <h4 className="text-2xs uppercase tracking-wider font-bold text-text-muted">What it does</h4>
            <p className="text-xs text-text-primary mt-1 leading-normal font-sans">{selectedInfo.what}</p>
          </div>

          <div>
            <h4 className="text-2xs uppercase tracking-wider font-bold text-text-muted">Why it works this way</h4>
            <p className="text-xs text-text-primary mt-1 leading-normal font-sans">{selectedInfo.why}</p>
          </div>

          <div>
            <h4 className="text-2xs uppercase tracking-wider font-bold text-text-muted">Technology Stack</h4>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {selectedInfo.tech.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-3xs font-mono bg-bg-page border border-border-subtle text-text-secondary rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border-subtle">
            <h4 className="text-2xs uppercase tracking-wider font-bold text-text-muted mb-2">Live Subsystem Metrics</h4>
            {getMetrics()}
          </div>
        </div>
      </div>
    </div>
  );
};
