import { useEffect, useReducer, useState } from 'react';
import { getHealth } from '../lib/apiClient';
import { useNavigate } from 'react-router-dom';
import { HealthResponse } from '../types/api';

type StepStatus = 'checking' | 'ok' | 'failed';

interface BootStep {
    key: string;
    label: string;
    status: StepStatus;
    detail?: string;
}

interface State {
    steps: BootStep[];
    hasFailed: boolean;
    isFinished: boolean;
    errorMsg: string | null;
    isFetching: boolean;
}

type Action =
    | { type: 'START_CHECK' }
    | { type: 'FETCH_SUCCESS' }
    | { type: 'FETCH_ERROR'; payload: string }
    | { type: 'REVEAL_STEP'; payload: BootStep };

const initialSteps: BootStep[] = [
    { key: 'redis', label: 'Redis', status: 'checking', detail: 'Connecting...' },
    { key: 'postgres', label: 'PostgreSQL', status: 'checking', detail: 'Connecting...' },
    { key: 'worker', label: 'Worker process', status: 'checking', detail: 'Locating worker...' },
    { key: 'warmPool', label: 'Warm pool', status: 'checking', detail: 'Verifying containers...' },
    { key: 'queue', label: 'Queue ready', status: 'checking', detail: 'Checking queues...' },
];

const initialState: State = {
    steps: initialSteps,
    hasFailed: false,
    isFinished: false,
    errorMsg: null,
    isFetching: false,
};

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case 'START_CHECK':
            return {
                ...state,
                steps: initialSteps.map(s => ({ ...s, status: 'checking', detail: s.detail })),
                hasFailed: false,
                isFinished: false,
                errorMsg: null,
                isFetching: true,
            };
        case 'FETCH_SUCCESS':
            return {
                ...state,
                isFetching: false,
            };
        case 'FETCH_ERROR': {
            const failedSteps = state.steps.map(step => ({
                ...step,
                status: 'failed' as const,
                detail: action.payload,
            }));
            return {
                ...state,
                steps: failedSteps,
                hasFailed: true,
                isFinished: false,
                errorMsg: action.payload,
                isFetching: false,
            };
        }
        case 'REVEAL_STEP': {
            const updatedSteps = state.steps.map(step =>
                step.key === action.payload.key ? action.payload : step
            );
            
            const allProcessed = updatedSteps.every(step => step.status !== 'checking');
            const anyFailed = updatedSteps.some(step => step.status === 'failed');
            const allSuccess = allProcessed && !anyFailed;

            return {
                ...state,
                steps: updatedSteps,
                hasFailed: anyFailed,
                isFinished: allSuccess,
            };
        }
        default:
            return state;
    }
}

export const BootPage = () => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [retryTrigger, setRetryTrigger] = useState(0);
    const navigate = useNavigate();

    const handleRetry = () => {
        setRetryTrigger(prev => prev + 1);
    };

    useEffect(() => {
        // Skip on return logic: if already booted, immediately skip to /workspace
        const booted = localStorage.getItem('cee_booted');
        if (booted === '1') {
            navigate('/workspace', { replace: true });
            return;
        }

        let isMounted = true;
        const timeouts: any[] = [];

        const checkSystem = async () => {
            dispatch({ type: 'START_CHECK' });
            try {
                const data: HealthResponse = await getHealth();
                if (!isMounted) return;

                // Extract dependency info from response
                const redisDep = data.dependencies?.find(d => d.name === 'redis') || data.boot?.find(b => b.id === 'redis');
                const postgresDep = data.dependencies?.find(d => d.name === 'postgres') || data.boot?.find(b => b.id === 'postgres');
                const workerDep = data.dependencies?.find(d => d.name === 'worker');
                const workerBoot = data.boot?.find(b => b.id === 'worker');
                const queueDep = data.dependencies?.find(d => d.name === 'executionQueue') || data.boot?.find(b => b.id === 'executionQueue');

                const workerMeta = workerDep?.meta as any;
                const containerPool = workerMeta?.containerPool;

                const redisStatus = redisDep?.state === 'connected' ? 'ok' : 'failed';
                const postgresStatus = postgresDep?.state === 'connected' ? 'ok' : 'failed';
                const workerStatus = (workerDep?.state === 'connected' || workerDep?.state === 'warming' || workerBoot?.state === 'connected' || workerBoot?.state === 'warming') ? 'ok' : 'failed';

                let warmPoolStatus: 'ok' | 'failed' = 'ok';
                let warmPoolDetail = 'Checking...';
                if (workerStatus === 'failed') {
                    warmPoolStatus = 'failed';
                    warmPoolDetail = 'Worker process failed';
                } else if (containerPool) {
                    const available = containerPool.available ?? 0;
                    const target = containerPool.target ?? 5;
                    if (containerPool.warming) {
                        warmPoolDetail = `Warming up (${available}/${target} containers)`;
                    } else {
                        warmPoolDetail = `${available}/${target} containers ready`;
                    }
                } else {
                    const available = workerMeta?.containerPool?.available ?? 0;
                    warmPoolDetail = `${available} containers ready`;
                }

                const queueStatus = queueDep?.state === 'connected' ? 'ok' : 'failed';

                const mappedSteps: BootStep[] = [
                    { key: 'redis', label: 'Redis', status: redisStatus, detail: redisDep?.detail || (redisStatus === 'ok' ? 'Connected' : 'Unavailable') },
                    { key: 'postgres', label: 'PostgreSQL', status: postgresStatus, detail: postgresDep?.detail || (postgresStatus === 'ok' ? 'Connected' : 'Unavailable') },
                    { key: 'worker', label: 'Worker process', status: workerStatus, detail: workerDep?.detail || workerBoot?.detail || (workerStatus === 'ok' ? 'Active' : 'Unavailable') },
                    { key: 'warmPool', label: 'Warm pool', status: warmPoolStatus, detail: warmPoolDetail },
                    { key: 'queue', label: 'Queue ready', status: queueStatus, detail: queueDep?.detail || (queueStatus === 'ok' ? 'Connected' : 'Unavailable') }
                ];

                dispatch({ type: 'FETCH_SUCCESS' });

                // Stagger the reveal of steps
                mappedSteps.forEach((step, index) => {
                    const t = setTimeout(() => {
                        if (isMounted) {
                            dispatch({ type: 'REVEAL_STEP', payload: step });
                        }
                    }, index * 150);
                    timeouts.push(t);
                });

            } catch (err: any) {
                if (!isMounted) return;
                const errMsg = err?.message || 'Unknown network error';
                dispatch({ type: 'FETCH_ERROR', payload: errMsg });
            }
        };

        checkSystem();

        return () => {
            isMounted = false;
            timeouts.forEach(clearTimeout);
        };
    }, [navigate, retryTrigger]);

    useEffect(() => {
        if (state.isFinished) {
            const timer = setTimeout(() => {
                localStorage.setItem('cee_booted', '1');
                navigate('/workspace');
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [state.isFinished, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)] p-6 transition-colors duration-300 font-sans">
            <style>{`
                @keyframes fadeSlideIn {
                    0% {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .step-row {
                    opacity: 0;
                    animation: fadeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    animation-delay: calc(var(--i) * 150ms);
                }
            `}</style>
            
            <div className={`w-full max-w-md bg-[var(--bg-card)] border ${state.hasFailed ? 'border-[var(--status-failed)] shadow-lg shadow-red-100/10' : 'border-[var(--border)] shadow-md'} rounded-xl overflow-hidden transition-all duration-500`}>
                
                {/* Header Section */}
                <div className="p-6 pb-4 border-b border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
                            System Startup
                        </span>
                        {state.isFinished ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[var(--status-completed)] border border-emerald-200">
                                READY
                            </span>
                        ) : state.hasFailed ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-[var(--status-failed)] border border-red-200">
                                ERROR
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-[var(--status-pending)] border border-indigo-200">
                                BOOTING
                            </span>
                        )}
                    </div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">
                        Code Execution Engine
                    </h1>
                </div>

                {/* Body - Step List */}
                <div className="px-6 py-4 space-y-3">
                    {state.steps.map((step, index) => {
                        const isChecking = step.status === 'checking';
                        const isOk = step.status === 'ok';
                        const isFailed = step.status === 'failed';
                        
                        return (
                            <div 
                                key={step.key} 
                                className="step-row flex items-center justify-between py-2 border-b border-[var(--border)]/30 last:border-0"
                                style={{ '--i': index } as React.CSSProperties}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Icon Indicator */}
                                    <div className="flex items-center justify-center w-5 h-5">
                                        {isChecking && (
                                            <svg className="animate-spin h-4.5 w-4.5 text-[var(--status-pending)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        )}
                                        {isOk && (
                                            <svg className="h-5 w-5 text-[var(--status-completed)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        {isFailed && (
                                            <svg className="h-5 w-5 text-[var(--status-failed)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        )}
                                    </div>
                                    
                                    {/* Step Label */}
                                    <span className="font-semibold text-sm text-[var(--text-primary)]">
                                        {step.label}
                                    </span>
                                </div>

                                {/* Step Detail */}
                                <span className={`font-mono text-xs max-w-[200px] truncate ${isFailed ? 'text-[var(--status-failed)]' : isChecking ? 'text-[var(--text-secondary)]/50' : 'text-[var(--text-secondary)]'}`}>
                                    {step.detail}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Section */}
                <div className={`p-6 bg-[var(--bg-card)]/30 border-t border-[var(--border)]/50 flex flex-col items-center justify-center`}>
                    {state.isFinished && (
                        <div className="flex items-center gap-2 text-sm text-[var(--status-completed)] font-medium">
                            <svg className="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            All services healthy. Entering workspace...
                        </div>
                    )}
                    
                    {state.hasFailed && (
                        <div className="w-full flex flex-col items-center space-y-3">
                            <span className="text-xs text-[var(--status-failed)] font-semibold text-center leading-relaxed">
                                Initialization aborted. Some services are degraded or unreachable.
                            </span>
                            <button
                                onClick={handleRetry}
                                className="px-5 py-2 text-xs font-semibold tracking-wide uppercase text-white bg-[var(--status-failed)] hover:bg-red-800 active:scale-95 rounded-lg border border-red-900 transition-all duration-150 shadow shadow-red-200/20"
                            >
                                Retry Initialization
                            </button>
                        </div>
                    )}

                    {!state.isFinished && !state.hasFailed && (
                        <span className="text-xs text-[var(--text-secondary)] italic animate-pulse-glow">
                            Verifying engine status...
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};