import React from "react";

interface ArchitectureFlowProps {
  selectedNode: string;
  onSelectNode: (nodeId: string) => void;
  activeStatus: "idle" | "submitting" | "streaming" | "done" | "failed" | "cancelled";
}

export const ArchitectureFlow: React.FC<ArchitectureFlowProps> = ({
  selectedNode,
  onSelectNode,
  activeStatus,
}) => {
  // Determine if a node is currently active in the execution pipeline
  const isNodeRunning = (nodeId: string): boolean => {
    if (activeStatus === "idle") return false;
    switch (nodeId) {
      case "browser":
        return activeStatus === "submitting";
      case "api":
        return activeStatus === "submitting";
      case "queue":
        return activeStatus === "streaming";
      case "worker":
        return activeStatus === "streaming";
      case "docker":
        return activeStatus === "streaming";
      case "db":
        return activeStatus === "done";
      default:
        return false;
    }
  };

  const nodes = [
    { id: "browser", label: "Browser (Client)", y: 40, desc: "Monaco editor submitting code payloads via Fetch API." },
    { id: "api", label: "API Gateway", y: 120, desc: "Express service running token bucket rate limit & writing to DB." },
    { id: "queue", label: "BullMQ Queue", y: 200, desc: "Redis-backed execution queue orchestrating jobs." },
    { id: "worker", label: "Executor Worker", y: 280, desc: "Multi-threaded consumer pulling job tasks and managing pools." },
    { id: "docker", label: "Docker Sandbox", y: 360, desc: "Pre-warmed, non-networked safe execution container." },
    { id: "db", label: "PostgreSQL DB", y: 440, desc: "State preservation storage storing execution results." },
  ];

  return (
    <div className="flex flex-col items-center justify-center p-4 h-full bg-bg-surface rounded border border-border-subtle shadow-sm">
      <h3 className="text-sm font-semibold text-text-primary mb-4 self-start flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-status-running animate-pulse" />
        Interactive System Architecture Flow
      </h3>
      <div className="relative w-full flex-grow max-h-[500px]">
        <svg viewBox="0 0 400 480" className="w-full h-full">
          {/* Definitions for gradients & shadow filters */}
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.1" />
            </filter>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--status-running)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
            <linearGradient id="defaultGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--bg-page)" />
              <stop offset="100%" stopColor="var(--bg-terminal)" />
            </linearGradient>
            {/* Arrow marker */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--border)" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--status-running)" />
            </marker>
          </defs>

          {/* Connectors (Lines) */}
          {nodes.map((node, index) => {
            if (index === nodes.length - 1) return null;
            const nextNode = nodes[index + 1];
            const running = isNodeRunning(node.id) && isNodeRunning(nextNode.id);
            return (
              <g key={`link-${node.id}`}>
                <line
                  x1={200}
                  y1={node.y + 25}
                  x2={200}
                  y2={nextNode.y - 25}
                  stroke={running ? "var(--status-running)" : "var(--border)"}
                  strokeWidth={running ? 3 : 2}
                  strokeDasharray={node.id === "worker" || node.id === "docker" ? "4,4" : undefined}
                  markerEnd={running ? "url(#arrow-active)" : "url(#arrow)"}
                  className={running ? "animate-pulse" : ""}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNode === node.id;
            const isRunning = isNodeRunning(node.id);

            // Determine border & background colors based on active / selected state
            const rectStroke = isSelected
              ? "var(--accent)"
              : isRunning
              ? "var(--status-running)"
              : "var(--border)";
            const rectFill = isRunning ? "url(#activeGradient)" : "url(#defaultGradient)";
            const textFill = isRunning ? "var(--bg-page)" : "var(--text-primary)";
            const labelWeight = isSelected || isRunning ? "font-bold" : "font-semibold";

            return (
              <g
                key={node.id}
                transform="translate(0, 0)"
                className="cursor-pointer transition-all duration-300"
                onClick={() => onSelectNode(node.id)}
              >
                {/* Glow for running/selected nodes */}
                {(isSelected || isRunning) && (
                  <rect
                    x={76}
                    y={node.y - 24}
                    width={248}
                    height={48}
                    rx={8}
                    fill="none"
                    stroke={isSelected ? "var(--accent)" : "var(--status-running)"}
                    strokeWidth={6}
                    opacity={0.3}
                    filter="url(#glow)"
                  />
                )}

                {/* Base Node Rectangle */}
                <rect
                  x={80}
                  y={node.y - 20}
                  width={240}
                  height={40}
                  rx={6}
                  fill={rectFill}
                  stroke={rectStroke}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  filter="url(#shadow)"
                  className="transition-colors duration-200"
                />

                {/* Node Label Text */}
                <text
                  x={200}
                  y={node.y + 5}
                  textAnchor="middle"
                  fill={textFill}
                  className={`text-xs ${labelWeight} select-none transition-colors duration-200`}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {node.label}
                </text>

                {/* Micro active animation dot */}
                {isRunning && (
                  <circle
                    cx={300}
                    cy={node.y}
                    r={4}
                    fill="var(--bg-page)"
                    className="animate-ping"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-2xs text-text-secondary mt-2 text-center">
        Click any node to inspect subsystem live metrics & technical implementation.
      </p>
    </div>
  );
};
