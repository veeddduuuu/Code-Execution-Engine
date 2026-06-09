import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ObservabilityPage } from "@/pages/ObservabilityPage";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const navItems = [
  { label: "Workspace", to: "/workspace" },
  { label: "Obs.", to: "/observability" },
];

export function App() {
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setIsBooting(false), 1100);

    return () => window.clearTimeout(bootTimer);
  }, []);

  if (isBooting) {
    return <BootSplash />;
  }

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <header className="border-b border-border-subtle bg-bg-surface">
        <nav className="mx-auto grid h-14 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4">
          <NavLink to="/workspace" className="font-mono text-lg font-semibold tracking-normal">
            CEE
          </NavLink>
          <div className="flex min-w-0 items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded px-3 py-1.5 text-sm text-text-secondary transition",
                    isActive ? "bg-bg-elevated text-text-primary" : "hover:bg-bg-muted hover:text-text-primary",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <a
            className="rounded px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-muted hover:text-text-primary"
            href="https://github.com"
          >
            GitHub
          </a>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/workspace" replace />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/observability" element={<ObservabilityPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

function BootSplash() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg-page px-4 text-text-primary">
      <section className="grid w-full max-w-xl gap-5 rounded border border-border-subtle bg-bg-surface p-6">
        <p className="font-mono text-sm text-accent-cyan">CEE</p>
        <h1 className="text-3xl font-semibold">Booting workspace</h1>
        <div className="h-2 overflow-hidden rounded bg-bg-muted">
          <div className="h-full w-2/3 rounded bg-accent-green" />
        </div>
        <p className="text-sm text-text-secondary">API, worker, queue, runtime, persistence</p>
      </section>
    </main>
  );
}
