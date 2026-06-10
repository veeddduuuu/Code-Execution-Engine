import { useEffect, useState } from "react";

export type JobLogEntry = {
    type: "LOG";
    stream: "stdout" | "stderr";
    data: string;
    ts: number;
};

export type JobDoneMessage = {
    type: "DONE";
    success: boolean;
    exitCode: number | null;
    ts: number;
};

export type JobCancelledMessage = {
    type: "CANCELLED";
    message: string;
    ts: number;
};

export type JobStreamMessage = JobLogEntry | JobDoneMessage | JobCancelledMessage;

export type JobStreamStatus = "idle" | "connecting" | "open" | "closed" | "error";

function getWebSocketUrl(): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
}

function parseJobStreamMessage(raw: string): JobStreamMessage | null {
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.type === "LOG" || parsed.type === "DONE" || parsed.type === "CANCELLED") {
            return parsed as JobStreamMessage;
        }
    } catch {
        // Ignore subscription acks and malformed payloads.
    }
    return null;
}

export const useJobStream = (jobId: string) => {
    const [logs, setLogs] = useState<JobLogEntry[]>([]);
    const [status, setStatus] = useState<JobStreamStatus>("idle");
    const [error, setError] = useState<Error | null>(null);
    const [result, setResult] = useState<JobDoneMessage | null>(null);
    const [cancelled, setCancelled] = useState<JobCancelledMessage | null>(null);

    useEffect(() => {
        setLogs([]);
        setError(null);
        setResult(null);
        setCancelled(null);

        if (!jobId) {
            setStatus("idle");
            return;
        }

        setStatus("connecting");

        const ws = new WebSocket(getWebSocketUrl());
        let closedByHook = false;

        ws.onopen = () => {
            setStatus("open");
            ws.send(JSON.stringify({ type: "SUBSCRIBE", jobId }));
        };

        ws.onmessage = (event) => {
            const message = parseJobStreamMessage(String(event.data));
            if (!message) return;

            if (message.type === "LOG") {
                setLogs((prev) => [...prev, message]);
                return;
            }

            if (message.type === "DONE") {
                setResult(message);
                setStatus("closed");
                return;
            }

            setCancelled(message);
            setStatus("closed");
        };

        ws.onerror = () => {
            if (closedByHook) return;
            setError(new Error("WebSocket connection failed"));
            setStatus("error");
        };

        ws.onclose = () => {
            if (closedByHook) return;
            setStatus((prev) => (prev === "error" ? prev : "closed"));
        };

        return () => {
            closedByHook = true;
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "UNSUBSCRIBE", jobId }));
            }
            ws.close();
        };
    }, [jobId]);

    return {
        logs,
        status,
        error,
        result,
        cancelled,
        isConnected: status === "open",
        isComplete: status === "closed",
    };
};