import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Router, Routes } from "react-router-dom";
import { ObservabilityPage } from "@/pages/ObservabilityPage";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { BootPage } from "./pages/BootPage";
import { Outlet } from "react-router-dom";
const navItems = [
  { label: "Workspace", to: "/workspace" },
  { label: "Obs.", to: "/observability" },
];

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/boot" replace />} />
      <Route path="/boot" element={<BootPage />} />

      <Route element={<AppLayout />}>
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/observability" element={<ObservabilityPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function AppLayout() {
  return(
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
            href="https://github.com/veeddduuuu/Code-Execution-Engine"
          >
            GitHub
          </a>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

