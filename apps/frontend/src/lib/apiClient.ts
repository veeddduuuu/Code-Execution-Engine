import { ApiError } from "./apiError";
export const apiFetch = async(url: string, options: RequestInit) =>{
    const response = await fetch(`/api/v1/${url}`, options);
    if(!response.ok){
        throw new ApiError(response.status, response.statusText, await response.text());
    }
    return response.json();
};

export const getHealth = async() => {
    const response = await fetch("/api/v1/health", { method: "GET" });
    const body = await response.json();

    if (!response.ok && response.status !== 503) {
        throw new ApiError(response.status, response.statusText, JSON.stringify(body));
    }

    return body;
};

export const getJobs = async() => {
    return apiFetch('jobs', { method: 'GET' });
};

export const getJobStatus = async(jobId: string) => {
    return apiFetch(`jobs/${jobId}`, { method: 'GET' });
};

export const cancelJob = async(jobId: string) => {
    return apiFetch(`jobs/${jobId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
};

export const executeCode = async(code: string, language: string, idempotencyKey?: string) => {
    return apiFetch('execute', {method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({code, language, idempotencyKey})});
};

