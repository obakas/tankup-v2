import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLiveBatch, type BatchLiveResponse } from "@/lib/batches";

const TERMINAL_BATCH_STATUSES = new Set([
  "completed",
  "partially_completed",
  "failed",
  "expired",
]);

export function useLiveBatch(
  batchId: number | null,
  memberId: number | null,
  intervalMs = 8000
) {
  const [batch, setBatch] = useState<BatchLiveResponse | null>(null);
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
    if (!batchId) {
      setBatch(null);
      setError(null);
      setIsLoading(false);
      stopPolling();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchLiveBatch(batchId, memberId);
      setBatch(result);

      if (!result) {
        setError("Live batch not found.");
        stopPolling();
        return;
      }

      if (TERMINAL_BATCH_STATUSES.has(result.status)) {
        stopPolling();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch live batch";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [batchId, memberId, stopPolling]);

  useEffect(() => {
    stopPolling();

    if (!batchId) {
      setBatch(null);
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
  }, [batchId, memberId, intervalMs, refresh, stopPolling]);

  return {
    batch,
    isLoading,
    error,
    refresh,
  };
}
