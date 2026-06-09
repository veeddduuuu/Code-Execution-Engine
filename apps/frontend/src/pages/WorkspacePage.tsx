import { useState, type ReactNode } from "react";

const jobs = [
  { id: "job_1824", status: "completed", language: "ts", duration: "208ms" },
  { id: "job_1823", status: "running", language: "js", duration: "live" },
  { id: "job_1822", status: "failed", language: "ts", duration: "31s" },
  { id: "job_1821", status: "cancelled", language: "js", duration: "4s" },
  { id: "job_1820", status: "completed", language: "ts", duration: "190ms" },
  { id: "job_1819", status: "queued", language: "js", duration: "pending" },
];

const metrics = [
  { label: "Warm Pool", value: "0 bps" },
  { label: "Queue Depth", value: "12" },
  { label: "Workers", value: "3 active" },
  { label: "P95 Runtime", value: "812ms" },
];

const pipelineEvents = ["Submit", "Persist", "Enqueue", "Worker pickup", "Container run", "Stream logs", "Finalize"];

export function WorkspacePage() {
  const [selectedJob, setSelectedJob] = useState(jobs[0].id);
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4">
      <section className="overflow-hidden border-y border-border-subtle bg-bg-page py-2 text-sm text-text-secondary">
        <p className="truncate">
          System status like headline if it does not fit. API orchestration, worker execution, Docker isolation, Redis queue, Postgres persistence.
        </p>
      </section>

      <section className="grid min-h-[calc(100vh-18rem)] gap-4 xl:grid-cols-[minmax(0,66fr)_minmax(22rem,34fr)]">
        <div className="grid min-h-[38rem] gap-4 xl:grid-rows-[minmax(28rem,1fr)_12rem]">
          <Panel className="bg-panel-editor" title="Editor">
            <div className="absolute right-4 top-4 flex gap-2">
              <button className="grid size-10 place-items-center rounded border border-border-strong bg-bg-inverse text-sm text-text-inverse">
                Run
              </button>
              <button className="grid size-10 place-items-center rounded border border-border-strong bg-bg-muted text-text-primary">
                X
              </button>
            </div>
            <div className="mt-6 grid h-[calc(100%-3rem)] grid-cols-[3rem_1fr] rounded border border-border-subtle bg-bg-page font-mono text-sm">
              <div className="grid content-start gap-2 border-r border-border-subtle p-3 text-right text-text-muted">
                {Array.from({ length: 12 }, (_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
              <div className="p-3 text-text-secondary">
                const result = await runCode();
                <br />
                console.log(result);
              </div>
            </div>
          </Panel>

          <Panel className="bg-panel-terminal" title="Terminal">
            <div className="mt-4 h-[calc(100%-2rem)] rounded border border-border-subtle bg-bg-page p-3 font-mono text-sm text-accent-green">
              $ awaiting execution stream
            </div>
          </Panel>
        </div>

        <Panel className="min-h-[38rem] bg-panel-architecture" title="Architecture">
          <div className="mt-8 grid h-[calc(100%-8rem)] place-items-center">
            <div className="grid w-full max-w-xs gap-5">
              <Node label="API" tone="cyan" />
              <div className="mx-auto h-8 w-px bg-border-strong" />
              <Node label="Queue" tone="amber" />
              <div className="mx-auto h-8 w-px bg-border-strong" />
              <Node label="Worker + Docker" tone="green" />
              <div className="mx-auto h-8 w-px bg-border-strong" />
              <Node label="Postgres" tone="violet" />
            </div>
          </div>
          <button
            className="absolute bottom-4 left-4 right-4 rounded border border-border-focus bg-bg-elevated p-4 text-left text-sm text-text-primary transition hover:bg-bg-muted"
            onClick={() => setIsPipelineOpen(true)}
            type="button"
          >
            Pipeline highlight
          </button>
        </Panel>
      </section>

      <section className="grid gap-3 rounded border border-border-subtle bg-panel-history p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">Job history</p>
          <div className="flex gap-2">
            <button className="rounded border border-border-subtle px-3 py-1.5 text-sm text-text-secondary">Get more details</button>
            <button className="rounded bg-bg-inverse px-3 py-1.5 text-sm text-text-inverse">Rerun</button>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {jobs.map((job) => (
            <button
              className={[
                "grid min-w-48 gap-2 rounded border p-3 text-left text-sm transition",
                selectedJob === job.id ? "border-border-focus bg-bg-elevated" : "border-border-subtle bg-bg-surface hover:bg-bg-muted",
              ].join(" ")}
              key={job.id}
              onClick={() => setSelectedJob(job.id)}
              type="button"
            >
              <span className="font-mono text-text-primary">{job.id}</span>
              <span className="text-text-secondary">{job.status}</span>
              <span className="text-xs text-text-muted">
                {job.language} · {job.duration}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded border border-border-subtle bg-panel-warm p-4 md:grid-cols-[8rem_minmax(0,1fr)_8rem]">
        <div className="rounded border border-border-subtle bg-bg-muted blur-sm" />
        <div className="flex gap-4 overflow-x-auto">
          {metrics.map((metric) => (
            <article
              className="grid min-h-32 min-w-56 place-items-center rounded border border-border-strong bg-bg-surface p-4 text-center"
              key={metric.label}
            >
              <div>
                <p className="text-sm text-text-secondary">{metric.label}</p>
                <p className="mt-2 font-mono text-xl">{metric.value}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="rounded border border-border-subtle bg-bg-muted blur-sm" />
      </section>

      {isPipelineOpen ? <PipelineSheet onClose={() => setIsPipelineOpen(false)} /> : null}
    </main>
  );
}

type PanelProps = {
  children?: ReactNode;
  className: string;
  title: string;
};

function Panel({ children, className, title }: PanelProps) {
  return (
    <section className={`relative rounded border border-border-subtle p-4 ${className}`}>
      <p className="text-sm text-text-secondary">{title}</p>
      {children}
    </section>
  );
}

function Node({ label, tone }: { label: string; tone: "amber" | "cyan" | "green" | "violet" }) {
  const toneClass = {
    amber: "border-accent-amber",
    cyan: "border-accent-cyan",
    green: "border-accent-green",
    violet: "border-accent-violet",
  }[tone];

  return <div className={`rounded border ${toneClass} bg-bg-surface p-4 text-center text-sm text-text-secondary`}>{label}</div>;
}

function PipelineSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 bg-bg-page/70">
      <aside className="ml-auto grid h-full w-full max-w-md grid-rows-[auto_1fr] border-l border-border-subtle bg-bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-border-subtle p-4">
          <div>
            <p className="text-sm text-text-secondary">Side page</p>
            <h2 className="text-xl font-semibold">Event pipeline</h2>
          </div>
          <button className="rounded border border-border-subtle px-3 py-1.5 text-sm text-text-secondary" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="overflow-y-auto p-5">
          <div className="grid gap-5">
            {pipelineEvents.map((event, index) => (
              <div className="grid grid-cols-[1rem_1fr] gap-3" key={event}>
                <div className="grid justify-items-center">
                  <span className="size-3 rounded-full bg-accent-cyan" />
                  {index < pipelineEvents.length - 1 ? <span className="h-14 border-l border-dashed border-border-strong" /> : null}
                </div>
                <div className="rounded border border-border-subtle bg-bg-page p-3">
                  <p className="text-sm text-text-primary">{event}</p>
                  <p className="mt-1 text-xs text-text-muted">per-execution metrics placeholder</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
