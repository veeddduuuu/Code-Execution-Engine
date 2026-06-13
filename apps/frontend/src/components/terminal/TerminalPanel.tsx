import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { JobLogEntry } from "../../lib/useJobStream";

export interface TerminalPanelRef {
  write: (line: JobLogEntry) => void;
  clear: () => void;
  writeError: (msg: string) => void;
  writeWarning: (msg: string) => void;
  writeInfo: (msg: string) => void;
}

interface TerminalPanelProps {
  // We don't need selectedJobId here because the parent controls it imperatively.
}

export const TerminalPanel = forwardRef<TerminalPanelRef, TerminalPanelProps>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize Terminal
  useEffect(() => {
    if (!containerRef.current) return;

    // Use CSS variable var(--bg-terminal) style values for console background,
    // and var(--status-completed) style emerald green for foreground text.
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: "#050505", // near-black
        foreground: "#22c55e", // matches --status-completed
        cursor: "#e0e0e0",
      },
      fontSize: 13,
      fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace",
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Resize observer to handle responsiveness
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (err) {
        // ignore hidden state fitting errors
      }
    });
    resizeObserver.observe(containerRef.current);

    term.write("$ select a job to stream logs\r\n");

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    write: (log: JobLogEntry) => {
      const term = terminalRef.current;
      if (!term) return;

      if (log.stream === "stderr") {
        term.write(`\x1b[31m${log.data}\x1b[0m`); // red for stderr
      } else {
        // Check if the log is a special status or separator log
        if (log.data.includes("\x1b[")) {
          term.write(log.data); // Already contains ANSI styling
        } else {
          term.write(log.data); // Default text color
        }
      }
    },
    clear: () => {
      const term = terminalRef.current;
      if (term) {
        term.clear();
      }
    },
    writeError: (msg: string) => {
      const term = terminalRef.current;
      if (term) {
        term.write(`\r\n\x1b[31mError: ${msg}\x1b[0m\r\n`);
      }
    },
    writeWarning: (msg: string) => {
      const term = terminalRef.current;
      if (term) {
        term.write(`\r\n\x1b[33mWarning: ${msg}\x1b[0m\r\n`);
      }
    },
    writeInfo: (msg: string) => {
      const term = terminalRef.current;
      if (term) {
        term.write(`\r\n\x1b[32m${msg}\x1b[0m\r\n`);
      }
    }
  }));

  return (
    <div className="mt-4 h-[calc(100%-2rem)] rounded border border-border-subtle overflow-hidden bg-bg-muted p-2">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
});

TerminalPanel.displayName = "TerminalPanel";
