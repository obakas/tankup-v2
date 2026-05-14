import { useCallback, useEffect, useRef, useState } from "react";
import {
    fetchLivePriorityRequest,
    type PriorityLiveResponse,
} from "@/lib/requests";

const isPriorityTerminal = (data: PriorityLiveResponse | null) => {
    if (!data) return true;

    return (
        data.delivery_status === "delivered" ||
        data.delivery_status === "failed" ||
        data.delivery_status === "skipped" ||
        data.request_status === "completed" ||
        data.request_status === "partially_completed" ||
        data.request_status === "failed" ||
        data.request_status === "expired" ||
        data.customer_confirmed
    );
};

export function useLivePriorityRequest(
    requestId: number | null,
    intervalMs = 8000
) {
    const [request, setRequest] = useState<PriorityLiveResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const intervalRef = useRef<number | null>(null);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const refresh = useCallback(async () => {
        if (!requestId) {
            setRequest(null);
            setError(null);
            setIsLoading(false);
            stopPolling();
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const data = await fetchLivePriorityRequest(requestId);
            setRequest(data);

            if (!data) {
                setError("Live priority request not found.");
                stopPolling();
                return;
            }

            if (isPriorityTerminal(data)) {
                stopPolling();
            }
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to fetch live priority request";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [requestId, stopPolling]);

    useEffect(() => {
        stopPolling();

        if (!requestId) {
            setRequest(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        let isMounted = true;

        const load = async () => {
            if (!isMounted) return;
            await refresh();
        };

        void load();
        intervalRef.current = window.setInterval(load, intervalMs);

        return () => {
            isMounted = false;
            stopPolling();
        };
    }, [requestId, intervalMs, refresh, stopPolling]);

    return {
        request,
        isLoading,
        error,
        refresh,
    };
}
