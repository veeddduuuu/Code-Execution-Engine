import React, { useState } from "react";

export function ArchitecturePage() {
  const [activeSec, setActiveSec] = useState<"overview" | "api" | "queue" | "worker" | "docker" | "security">("overview");

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 font-sans">
      <section className="bg-bg-surface rounded border border-border-subtle p-6 shadow-sm">
        {/* Header */}
        <div className="border-b border-border-subtle pb-4 mb-6">
          <h1 className="text-2xl font-bold text-text-primary">System Architecture & Engineering Specification</h1>
          <p className="text-sm text-text-secondary mt-1">
            An in-depth breakdown of the design patterns, security controls, and infrastructure orchestration of the Code Execution Engine.
          </p>
        </div>

        {/* Tab Selectors */}
        <div className="flex border-b border-border-subtle overflow-x-auto pb-px mb-6 no-scrollbar">
          {[
            { id: "overview", label: "System Overview" },
            { id: "api", label: "Orchestration API" },
            { id: "queue", label: "BullMQ / Redis Queue" },
            { id: "worker", label: "Multi-Threaded Worker" },
            { id: "docker", label: "Pre-Warmed Pool" },
            { id: "security", label: "Security & Sandbox" },
          ].map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSec(sec.id as any)}
              className={`py-2 px-4 text-xs font-mono font-bold border-b-2 whitespace-nowrap transition-all ${
                activeSec === sec.id
                  ? "border-accent text-accent bg-bg-muted/30"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-page/50"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panels */}
        <div className="space-y-6 text-sm text-text-primary leading-relaxed">
          {activeSec === "overview" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-text-primary">Operational Pipeline Flow</h2>
              <p>
                The Code Execution Engine executes untrusted user-submitted code in real time while maintaining strict resource limits, sandboxed networks, and sub-second execution latencies.
              </p>
              
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div className="p-4 bg-bg-page rounded border border-border-subtle shadow-2xs">
                  <h3 className="font-bold text-xs uppercase text-accent font-mono">1. Code Ingestion</h3>
                  <p className="text-xs text-text-secondary mt-1.5">
                    Web clients send code inputs via Monaco Editor. The Express API parses arguments, validates rates, logs states, and buffers the task inside BullMQ.
                  </p>
                </div>
                <div className="p-4 bg-bg-page rounded border border-border-subtle shadow-2xs">
                  <h3 className="font-bold text-xs uppercase text-accent font-mono">2. Queue & Dispatch</h3>
                  <p className="text-xs text-text-secondary mt-1.5">
                    BullMQ manages tasks in a Redis backend. Workers pull queued tasks, guaranteeing order, backoff retries, and high-concurrency dispatch.
                  </p>
                </div>
                <div className="p-4 bg-bg-page rounded border border-border-subtle shadow-2xs">
                  <h3 className="font-bold text-xs uppercase text-accent font-mono">3. Sandboxed Run</h3>
                  <p className="text-xs text-text-secondary mt-1.5">
                    Workers check out pre-warmed Alpine Linux containers. The code is written to /tmp inside the sandbox, executed, and the output is streamed immediately over WebSockets.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSec === "api" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-text-primary">Orchestration & Ingestion Layer</h2>
              <p>
                The API gateway is optimized for ingestion throughput. It does not perform any heavy CPU operations; instead, it coordinates task metadata, handles WebSocket log subscriptions, and persists states to PostgreSQL.
              </p>
              
              <div className="bg-bg-page p-4 rounded border border-border-subtle font-mono text-2xs space-y-2">
                <p className="text-accent font-semibold">// Key Architectural Safeguards:</p>
                <p>1. Token Bucket Rate Limiting: 10 requests/min burst capacity, refilled at 2 requests/sec.</p>
                <p>2. Transaction Lock Idempotency: Prevents double-submission using SHA-256 client headers.</p>
                <p>3. Pub/Sub Message Demux: Uses Redis Pub/Sub channels to multiplex logs across WS lines.</p>
              </div>
            </div>
          )}

          {activeSec === "queue" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-text-primary">BullMQ / Redis Queuing Model</h2>
              <p>
                To handle traffic spikes, we decouple the API gateways from the workers using BullMQ.
              </p>
              
              <ul className="list-disc list-inside space-y-2 text-xs text-text-secondary">
                <li>
                  <strong className="text-text-primary">Backpressure Management:</strong> If the container pool is busy or workers are saturated, jobs queue up in Redis rather than crashing the API.
                </li>
                <li>
                  <strong className="text-text-primary">Retries and Backoffs:</strong> Failed jobs due to worker restarts are automatically retried with exponential backoff (1s, 2s, 4s).
                </li>
                <li>
                  <strong className="text-text-primary">Dead Letter Queue (DLQ):</strong> After exhausting all retries, failed tasks are stored as "dead" state. These can be manually inspected and replayed from the Observability Dashboard.
                </li>
              </ul>
            </div>
          )}

          {activeSec === "worker" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-text-primary">Multi-Threaded Executor Daemon</h2>
              <p>
                Workers are the core computational drivers. Each worker runs a concurrency limit of 3, meaning it can execute 3 docker tasks in parallel.
              </p>
              <p>
                The worker acts as a bridge between BullMQ and the Docker Socket. It checks out container resources, creates execution streams, pipes output lines in real time, and terminates long-running scripts (hard limit 30s).
              </p>
            </div>
          )}

          {activeSec === "docker" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-text-primary">Pre-Warmed Docker Container Pool</h2>
              <p>
                Standard Docker container boots take between 300ms and 800ms. To achieve sub-15ms run start latencies, the worker runs a background thread that manages a pool of <strong>pre-warmed, idle containers</strong>.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                <div className="p-4 bg-bg-page rounded border border-border-subtle">
                  <h3 className="font-bold text-xs uppercase text-text-primary">Warmed Checkout Flow</h3>
                  <p className="text-xs text-text-secondary mt-1">
                    When a job arrives, the worker checks out a warmed container from the pool, mounts the generated code file into the workspace, and runs it instantly (<strong className="text-accent-green">start time &lt;10ms</strong>).
                  </p>
                </div>
                <div className="p-4 bg-bg-page rounded border border-border-subtle">
                  <h3 className="font-bold text-xs uppercase text-text-primary">Background Replenishment</h3>
                  <p className="text-xs text-text-secondary mt-1">
                    As soon as a container is checked out, a background routine spawns a replacement container so that the pool size always remains at the target baseline (e.g. 5 warmed slots).
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSec === "security" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-text-primary">Host Sandbox Security Specifications</h2>
              <p>
                Executing untrusted scripts is a high-risk operation. The CEE employs multiple overlapping layers of sandboxing defense:
              </p>
              
              <div className="space-y-3 mt-3">
                <div className="flex items-start space-x-3 text-xs">
                  <span className="p-1 bg-accent-red/10 text-accent-red rounded font-mono font-bold shrink-0">DEF-1</span>
                  <div>
                    <strong className="text-text-primary block">No Network Interface</strong>
                    <span className="text-text-secondary">Containers are created with <code>--network=none</code>. User code cannot download malware or trigger outgoing DDOS attacks.</span>
                  </div>
                </div>
                <div className="flex items-start space-x-3 text-xs">
                  <span className="p-1 bg-accent-red/10 text-accent-red rounded font-mono font-bold shrink-0">DEF-2</span>
                  <div>
                    <strong className="text-text-primary block">Read-Only Root Filesystem</strong>
                    <span className="text-text-secondary">The container's root file structure is mounted as read-only. User scripts cannot edit binaries, configure system logs, or install rootkits. Users can write only to an isolated <code>/tmp</code> scratch folder.</span>
                  </div>
                </div>
                <div className="flex items-start space-x-3 text-xs">
                  <span className="p-1 bg-accent-red/10 text-accent-red rounded font-mono font-bold shrink-0">DEF-3</span>
                  <div>
                    <strong className="text-text-primary block">Non-Root User Context</strong>
                    <span className="text-text-secondary">Code runs under a low-privilege "node" user account. Rerouting or escalating privilege to host-level is prohibited by kernel-enforced drop capabilities.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
