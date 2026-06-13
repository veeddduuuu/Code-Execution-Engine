import React from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { BootPage } from "./pages/BootPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { ObservabilityPage } from "./pages/ObservabilityPage";
import { ArchitecturePage } from "./pages/ArchitecturePage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function App() {
  const location = useLocation();
  const isBoot = location.pathname === "/boot" || location.pathname === "/";

  return (
    <div className="min-h-screen text-text-primary selection:bg-accent/30 selection:text-white">
      {/* Hide navbar on Boot screen */}
      {!isBoot && (
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-[var(--bg-glass)] backdrop-blur-xl border border-border-strong rounded-full px-5 py-2.5 shadow-2xl flex items-center justify-between w-[90%] max-w-4xl transition-all">
          <div className="flex items-center space-x-6">
            <Link className="text-base font-bold text-text-primary flex items-center gap-2 drop-shadow-md" to="/workspace">
              <span className="h-3 w-3 bg-accent rounded-full shadow-[0_0_8px_var(--status-completed)]" />
              CEE <span className="text-3xs px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono text-text-secondary tracking-wide">v1.0</span>
            </Link>
            <div className="flex space-x-5 text-xs font-semibold tracking-wide">
              <Link
                className={`transition-colors ${
                  location.pathname === "/workspace" ? "text-text-primary drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]" : "text-text-secondary hover:text-text-primary"
                }`}
                to="/workspace"
              >
                Workspace
              </Link>
              <Link
                className={`transition-colors ${
                  location.pathname === "/observability" ? "text-text-primary drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]" : "text-text-secondary hover:text-text-primary"
                }`}
                to="/observability"
              >
                Observability
              </Link>
              <Link
                className={`transition-colors ${
                  location.pathname === "/architecture" ? "text-text-primary drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]" : "text-text-secondary hover:text-text-primary"
                }`}
                to="/architecture"
              >
                Architecture
              </Link>
            </div>
          </div>
          <a
            className="text-xs text-text-secondary hover:text-text-primary hover:bg-white/10 border border-white/5 rounded-full px-3 py-1 bg-white/5 font-mono transition-all"
            href="https://github.com/veeddduuuu/Code-Execution-Engine"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      )}

      <Routes>
        <Route path="/" element={<Navigate to="/boot" replace />} />
        <Route path="/boot" element={<BootPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/observability" element={<ObservabilityPage />} />
        <Route path="/architecture" element={<ArchitecturePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
