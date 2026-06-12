import { useEffect, useLayoutEffect, useRef, useReducer } from "react";

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

type StreamState = {
    jobId: string;
    logs: JobLogEntry[];
    status: JobStreamStatus;
    error: Error | null;
    result: JobDoneMessage | null;
    cancelled: JobCancelledMessage | null;
};

type StreamAction =
    | { type: "CONNECTING" }
    | { type: "OPEN" }
    | { type: "LOG"; payload: JobLogEntry }
    | { type: "DONE"; payload: JobDoneMessage }
    | { type: "CANCELLED"; payload: JobCancelledMessage }
    | { type: "ERROR"; payload: Error }
    | { type: "CLOSE" }
    | { type: "RESET"; payload: { jobId: string } };

const initialState: Omit<StreamState, "jobId"> = {
    logs: [],
    status: "idle",
    error: null,
    result: null,
    cancelled: null,
};

function streamReducer(state: StreamState, action: StreamAction): StreamState {
    switch (action.type) {
        case "RESET":
            return { ...initialState, jobId: action.payload.jobId };
        case "CONNECTING":
            return { ...state, status: "connecting", error: null };
        case "OPEN":
            return { ...state, status: "open", error: null };
        case "LOG":
            return { ...state, logs: [...state.logs, action.payload] };
        case "DONE":
            return { ...state, status: "closed", result: action.payload };
        case "CANCELLED":
            return { ...state, status: "closed", cancelled: action.payload };
        case "ERROR":
            return { ...state, status: "error", error: action.payload };
        case "CLOSE":
            return { ...state, status: state.status === "error" ? "error" : "closed" };
        default:
            return state;
    }
}

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
    const [state, dispatch] = useReducer(streamReducer, { ...initialState, jobId });
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef<any>(null);
    const isClosedByUnmountRef = useRef(false);
    const wasDisconnectedRef = useRef(false);
    const terminalReceivedRef = useRef(false);

    useLayoutEffect(() => {
        dispatch({ type: "RESET", payload: { jobId } });
        reconnectAttemptsRef.current = 0;
        isClosedByUnmountRef.current = false;
        wasDisconnectedRef.current = false;
        terminalReceivedRef.current = false;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (!jobId) {
            return;
        }

        const connect = () => {
            if (isClosedByUnmountRef.current) return;
            dispatch({ type: "CONNECTING" });

            const ws = new WebSocket(getWebSocketUrl());
            wsRef.current = ws;

            ws.onopen = () => {
                dispatch({ type: "OPEN" });
                reconnectAttemptsRef.current = 0;
                
                if (wasDisconnectedRef.current) {
                    dispatch({
                        type: "LOG",
                        payload: {
                            type: "LOG",
                            stream: "stdout",
                            data: "\r\n\x1b[33m— reconnected, replaying logs —\x1b[0m\r\n",
                            ts: Date.now(),
                        },
                    });
                    wasDisconnectedRef.current = false;
                }

                ws.send(JSON.stringify({ type: "SUBSCRIBE", jobId }));
            };

            ws.onmessage = (event) => {
                const message = parseJobStreamMessage(String(event.data));
                if (!message) return;

                if (message.type === "LOG") {
                    dispatch({ type: "LOG", payload: message });
                } else if (message.type === "DONE") {
                    terminalReceivedRef.current = true;
                    dispatch({ type: "DONE", payload: message });
                    ws.close();
                } else if (message.type === "CANCELLED") {
                    terminalReceivedRef.current = true;
                    dispatch({ type: "CANCELLED", payload: message });
                    ws.close();
                }
            };

            ws.onerror = () => {
                if (isClosedByUnmountRef.current) return;
                dispatch({ type: "ERROR", payload: new Error("WebSocket connection failed") });
            };

            ws.onclose = () => {
                if (isClosedByUnmountRef.current) return;
                if (ws !== wsRef.current) return;

                // If the job did not finish with DONE or CANCELLED, try to reconnect
                const wsState = wsRef.current;
                if (wsState && !terminalReceivedRef.current && reconnectAttemptsRef.current < 3) {
                    wasDisconnectedRef.current = true;
                    const delay = 1000 * Math.pow(2, reconnectAttemptsRef.current);
                    reconnectAttemptsRef.current += 1;

                    dispatch({
                        type: "LOG",
                        payload: {
                            type: "LOG",
                            stream: "stderr",
                            data: `\r\n\x1b[33mWebSocket disconnected. Reconnecting in ${delay / 1000}s... (Attempt ${reconnectAttemptsRef.current}/3)\x1b[0m\r\n`,
                            ts: Date.now(),
                        },
                    });

                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, delay);
                } else {
                    dispatch({ type: "CLOSE" });
                }
            };
        };

        connect();

        return () => {
            isClosedByUnmountRef.current = true;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "UNSUBSCRIBE", jobId }));
                }
                wsRef.current.close();
            }
        };
    }, [jobId]);

    const isCurrentJob = state.jobId === jobId;
    const activeState = isCurrentJob ? state : { ...initialState, jobId };

    return {
        logs: activeState.logs,
        status: activeState.status,
        error: activeState.error,
        result: activeState.result,
        cancelled: activeState.cancelled,
        isConnected: activeState.status === "open",
        isComplete: activeState.status === "closed",
    };
};