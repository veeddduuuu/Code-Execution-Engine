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
    <div className="min-h-screen bg-bg-page text-text-primary">
      {/* Hide navbar on Boot screen */}
      {!isBoot && (
        <nav className="border-b border-border-subtle bg-bg-surface py-3 px-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link className="text-lg font-bold text-text-primary flex items-center gap-2" to="/workspace">
                <span className="h-4 w-4 bg-accent rounded-sm inline-block" />
                CEE <span className="text-3xs px-1.5 py-0.5 rounded bg-bg-page border border-border-subtle font-mono text-text-secondary">v1.0</span>
              </Link>
              <div className="flex space-x-4 text-sm font-medium">
                <Link
                  className={`hover:text-text-primary transition-colors ${
                    location.pathname === "/workspace" ? "text-accent font-semibold" : "text-text-secondary"
                  }`}
                  to="/workspace"
                >
                  Workspace
                </Link>
                <Link
                  className={`hover:text-text-primary transition-colors ${
                    location.pathname === "/observability" ? "text-accent font-semibold" : "text-text-secondary"
                  }`}
                  to="/observability"
                >
                  Observability
                </Link>
                <Link
                  className={`hover:text-text-primary transition-colors ${
                    location.pathname === "/architecture" ? "text-accent font-semibold" : "text-text-secondary"
                  }`}
                  to="/architecture"
                >
                  Archit.
                </Link>
              </div>
            </div>
            <a
              className="text-xs text-text-secondary hover:text-text-primary border border-border-subtle rounded px-2.5 py-1 bg-bg-page font-mono transition-all"
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
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
