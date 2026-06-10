import { useEffect, useState } from "react";
import { getHealth } from "./apiClient";
import { HealthResponse } from "../types/api";
export const useHealth = () => {
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        function fetchHealth(){
            getHealth().then(setHealth).catch(setError).finally(() => setIsLoading(false));
        }
        fetchHealth();
        const interval = setInterval(fetchHealth, 5000);
        return () => clearInterval(interval);
    }, []);

    return { health, error, isLoading };
}