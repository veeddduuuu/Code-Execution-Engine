import React, { useState } from "react";

export function ArchitecturePage() {
  const [activeSec, setActiveSec] = useState<"overview" | "api" | "queue" | "worker" | "docker" | "security">("overview");

  return (
    <main className="mx-auto max-w-4xl px-4 pt-24 pb-12 font-sans">
      <div className="bg-bg-surface rounded-3xl border border-white/5 p-8 md:p-12 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="border-b border-white/10 pb-8 mb-10 text-center">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">System Architecture & Engineering Specification</h1>
          <p className="text-sm text-text-secondary mt-3 max-w-2xl mx-auto leading-relaxed">
            An in-depth breakdown of the design patterns, security controls, and infrastructure orchestration of the Code Execution Engine.
          </p>
        </div>

        {/* Doc Content */}
        <div className="space-y-16 text-sm text-text-primary leading-relaxed">
          
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-3">
              <span className="text-accent-cyan font-mono text-sm px-2 py-1 bg-accent-cyan/10 rounded">01</span>
              Operational Pipeline Flow
            </h2>
            <p className="text-text-secondary text-base">
              The Code Execution Engine executes untrusted user-submitted code in real time while maintaining strict resource limits, sandboxed networks, and sub-second execution latencies.
            </p>
            
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                <h3 className="font-bold text-xs uppercase tracking-wide text-text-primary font-mono mb-2">Code Ingestion</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Web clients send code inputs via Monaco Editor. The Express API parses arguments, validates rates, logs states, and buffers the task inside BullMQ.
                </p>
              </div>
              <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                <h3 className="font-bold text-xs uppercase tracking-wide text-text-primary font-mono mb-2">Queue & Dispatch</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  BullMQ manages tasks in a Redis backend. Workers pull queued tasks, guaranteeing order, backoff retries, and high-concurrency dispatch.
                </p>
              </div>
              <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                <h3 className="font-bold text-xs uppercase tracking-wide text-text-primary font-mono mb-2">Sandboxed Run</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Workers check out pre-warmed Alpine containers. Code writes to /tmp inside the sandbox, executes, and outputs are streamed instantly over WebSockets.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-3">
              <span className="text-accent-green font-mono text-sm px-2 py-1 bg-accent-green/10 rounded">02</span>
              Orchestration & Ingestion Layer
            </h2>
            <p className="text-text-secondary text-base">
              The API gateway is optimized for ingestion throughput. It does not perform any heavy CPU operations; instead, it coordinates task metadata, handles WebSocket log subscriptions, and persists states to PostgreSQL.
            </p>
            
            <div className="bg-black/30 p-5 rounded-xl border border-white/5 font-mono text-xs space-y-3 mt-4">
              <p className="text-text-muted mb-2">// Key Architectural Safeguards:</p>
              <div className="flex gap-4"><span className="text-accent-cyan">01</span><span className="text-text-secondary">Token Bucket Rate Limiting: 10 requests/min burst capacity, refilled at 2 requests/sec.</span></div>
              <div className="flex gap-4"><span className="text-accent-cyan">02</span><span className="text-text-secondary">Transaction Lock Idempotency: Prevents double-submission using SHA-256 headers.</span></div>
              <div className="flex gap-4"><span className="text-accent-cyan">03</span><span className="text-text-secondary">Pub/Sub Message Demux: Uses Redis Pub/Sub channels to multiplex logs across WS lines.</span></div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-3">
              <span className="text-accent-amber font-mono text-sm px-2 py-1 bg-accent-amber/10 rounded">03</span>
              BullMQ / Redis Queuing Model
            </h2>
            <p className="text-text-secondary text-base">
              To handle traffic spikes, we decouple the API gateways from the workers using BullMQ.
            </p>
            
            <div className="grid gap-3 mt-4">
              <div className="p-4 bg-white/5 border border-white/5 rounded-lg flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-accent-amber shrink-0" />
                <div>
                  <strong className="text-text-primary block text-sm mb-1">Backpressure Management</strong>
                  <span className="text-xs text-text-secondary">If the container pool is busy or workers are saturated, jobs queue up in Redis rather than crashing the API.</span>
                </div>
              </div>
              <div className="p-4 bg-white/5 border border-white/5 rounded-lg flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-accent-amber shrink-0" />
                <div>
                  <strong className="text-text-primary block text-sm mb-1">Retries and Backoffs</strong>
                  <span className="text-xs text-text-secondary">Failed jobs due to worker restarts are automatically retried with exponential backoff (1s, 2s, 4s).</span>
                </div>
              </div>
              <div className="p-4 bg-white/5 border border-white/5 rounded-lg flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-accent-amber shrink-0" />
                <div>
                  <strong className="text-text-primary block text-sm mb-1">Dead Letter Queue (DLQ)</strong>
                  <span className="text-xs text-text-secondary">After exhausting all retries, failed tasks are stored as "dead" state. These can be manually inspected and replayed from the Observability Dashboard.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-3">
              <span className="text-accent-cyan font-mono text-sm px-2 py-1 bg-accent-cyan/10 rounded">04</span>
              Multi-Threaded Executor Daemon
            </h2>
            <p className="text-text-secondary text-base">
              Workers are the core computational drivers. Each worker runs a concurrency limit of 3, meaning it can execute 3 docker tasks in parallel.
            </p>
            <p className="text-text-secondary text-base">
              The worker acts as a bridge between BullMQ and the Docker Socket. It checks out container resources, creates execution streams, pipes output lines in real time, and terminates long-running scripts (hard limit 30s).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-3">
              <span className="text-status-running font-mono text-sm px-2 py-1 bg-status-running/10 rounded text-accent-cyan">05</span>
              Pre-Warmed Docker Container Pool
            </h2>
            <p className="text-text-secondary text-base">
              Standard Docker container boots take between 300ms and 800ms. To achieve sub-15ms run start latencies, the worker runs a background thread that manages a pool of <strong>pre-warmed, idle containers</strong>.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                <h3 className="font-bold text-xs uppercase tracking-wide text-text-primary mb-2">Warmed Checkout Flow</h3>
                <p className="text-xs text-text-secondary">
                  When a job arrives, the worker checks out a warmed container from the pool, mounts the generated code file into the workspace, and runs it instantly (<strong className="text-accent-green">start time &lt;10ms</strong>).
                </p>
              </div>
              <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                <h3 className="font-bold text-xs uppercase tracking-wide text-text-primary mb-2">Background Replenishment</h3>
                <p className="text-xs text-text-secondary">
                  As soon as a container is checked out, a background routine spawns a replacement container so that the pool size always remains at the target baseline.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-3">
              <span className="text-accent-red font-mono text-sm px-2 py-1 bg-accent-red/10 rounded">06</span>
              Host Sandbox Security Controls
            </h2>
            <p className="text-text-secondary text-base">
              Executing untrusted scripts is a high-risk operation. The CEE employs multiple overlapping layers of sandboxing defense:
            </p>
            
            <div className="space-y-4 mt-6">
              <div className="flex gap-4 p-4 border border-accent-red/20 bg-accent-red/5 rounded-xl">
                <span className="font-mono text-xs font-bold text-accent-red shrink-0 pt-0.5">DEF-1</span>
                <div>
                  <strong className="text-text-primary block text-sm mb-1">No Network Interface</strong>
                  <span className="text-xs text-text-secondary leading-relaxed block">Containers are created with <code>--network=none</code>. User code cannot download malware or trigger outgoing DDOS attacks.</span>
                </div>
              </div>
              <div className="flex gap-4 p-4 border border-accent-red/20 bg-accent-red/5 rounded-xl">
                <span className="font-mono text-xs font-bold text-accent-red shrink-0 pt-0.5">DEF-2</span>
                <div>
                  <strong className="text-text-primary block text-sm mb-1">Read-Only Root Filesystem</strong>
                  <span className="text-xs text-text-secondary leading-relaxed block">The container's root file structure is mounted as read-only. User scripts cannot edit binaries, configure system logs, or install rootkits. Isolated to <code>/tmp</code>.</span>
                </div>
              </div>
              <div className="flex gap-4 p-4 border border-accent-red/20 bg-accent-red/5 rounded-xl">
                <span className="font-mono text-xs font-bold text-accent-red shrink-0 pt-0.5">DEF-3</span>
                <div>
                  <strong className="text-text-primary block text-sm mb-1">Non-Root User Context</strong>
                  <span className="text-xs text-text-secondary leading-relaxed block">Code runs under a low-privilege "node" user account. Rerouting or escalating privilege to host-level is prohibited by kernel-enforced drop capabilities.</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
