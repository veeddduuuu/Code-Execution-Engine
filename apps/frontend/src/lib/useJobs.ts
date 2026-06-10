import { useEffect, useState } from "react";
import {getJobs} from "./apiClient";
import {Job} from "../types/api";

export const useJobs = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        function fetchJobs(){
            getJobs().then(setJobs).catch(setError);
        }
        fetchJobs();
        const interval = setInterval(fetchJobs, 10000);
        return () => clearInterval(interval);
    }, []);
    return { jobs, error };
}