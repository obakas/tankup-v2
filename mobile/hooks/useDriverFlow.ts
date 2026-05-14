import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import type { DriverStep } from "@/types/driver";
import {
  acceptOffer,
  completeBatchDelivery,
  completePriorityDelivery,
  driverLogout,
  DriverResponse,
  getCurrentJob,
  getCurrentStop,
  getIncomingOffer,
  markBatchLoaded,
  markPriorityLoaded,
  rejectOffer,
} from "@/lib/api";

const POLL_INTERVAL_MS = 4000;
const ROLE_KEY = "tankup_active_role";

type FlowStep = DriverStep | "auth";

export function useDriverFlow() {
  const [driver, setDriver] = useState<DriverResponse | null>(null);
  const [online, setOnline] = useState(false);
  const [step, setStep] = useState<FlowStep>("auth");

  const [offer, setOffer] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [currentStop, setCurrentStop] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goRoleHome = useCallback(async () => {
    await AsyncStorage.removeItem(ROLE_KEY);
    router.replace("/");
  }, []);

  const back = useCallback(() => {
    router.back();
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollOffer = useCallback(async () => {
    if (!driver) return;

    try {
      const res = await getIncomingOffer(driver.tankerId);
      if (res.has_offer) {
        setOffer(res.offer);
        setStep("incoming");
        stopPolling();
      }
    } catch {
      // Polling should be quiet. One bad request must not break the driver screen.
    }
  }, [driver, stopPolling]);

  const pollJob = useCallback(async () => {
    if (!driver) return;

    try {
      const res = await getCurrentStop(driver.tankerId);
      setCurrentStop(res);

      const tankerStatus = res?.tanker?.status ?? res?.tanker_status ?? "";
      if (["available", "completed"].includes(tankerStatus)) {
        setStep("available");
        setJob(null);
        stopPolling();
        pollRef.current = setInterval(pollOffer, POLL_INTERVAL_MS);
      }
    } catch {
      // Keep screen stable while backend/network breathes.
    }
  }, [driver, pollOffer, stopPolling]);

  useEffect(() => {
    stopPolling();
    if (!driver || !online) return;

    if (step === "available") {
      pollRef.current = setInterval(pollOffer, POLL_INTERVAL_MS);
    }

    if (["loading", "delivering"].includes(step)) {
      pollRef.current = setInterval(pollJob, POLL_INTERVAL_MS);
    }

    return stopPolling;
  }, [driver, online, step, pollOffer, pollJob, stopPolling]);

  const refreshJob = useCallback(async (d: DriverResponse) => {
    setLoading(true);

    try {
      const res = await getCurrentStop(d.tankerId);
      setCurrentStop(res);
      setJob(res);

      const tankerStatus = res?.tanker?.status ?? res?.tanker_status ?? "";
      if (tankerStatus === "assigned") setStep("loading");
      else if (["loading", "delivering", "arrived"].includes(tankerStatus)) setStep("delivering");
      else setStep("available");
    } catch {
      setStep("available");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAuthComplete = useCallback(
    (d: DriverResponse) => {
      setDriver(d);
      setOnline(d.is_online);

      if (["assigned", "loading", "delivering", "arrived"].includes(d.status)) {
        refreshJob(d);
      } else {
        setStep("available");
      }
    },
    [refreshJob]
  );

  const toggleOnline = useCallback(
    async (val: boolean) => {
      if (!driver) return;

      setOnline(val);

      if (!val) {
        stopPolling();
        setStep("offline");
        try {
          await driverLogout(driver.tankerId);
        } catch {
          // Don't punish the UI for a logout sync failure.
        }
      } else {
        setStep("available");
      }
    },
    [driver, stopPolling]
  );

  const handleAcceptOffer = useCallback(async () => {
    if (!driver) return;

    setActionLoading(true);
    setError(null);

    try {
      await acceptOffer(driver.tankerId);
      const jobRes = await getCurrentJob(driver.tankerId);
      setJob(jobRes);
      setCurrentStop(null);
      setStep("loading");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }, [driver]);

  const handleRejectOffer = useCallback(async () => {
    if (!driver) return;

    setActionLoading(true);
    setError(null);

    try {
      await rejectOffer(driver.tankerId);
      setOffer(null);
      setStep("available");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }, [driver]);

  const handleLoaded = useCallback(async () => {
    if (!driver || !job) return;

    setActionLoading(true);
    setError(null);

    try {
      if (job.job_type === "batch" || job.active_job?.batch_id) {
        const batchId = job.active_job?.batch_id ?? job.batch_id;
        await markBatchLoaded(driver.tankerId, batchId);
      } else {
        const requestId = job.active_job?.request_id ?? job.request_id;
        await markPriorityLoaded(driver.tankerId, requestId);
      }

      const res = await getCurrentStop(driver.tankerId);
      setCurrentStop(res);
      setStep("delivering");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }, [driver, job]);

  const handleCompleteJob = useCallback(async () => {
    if (!driver || !job) return;

    setActionLoading(true);
    setError(null);

    try {
      if (job.job_type === "batch" || job.active_job?.batch_id) {
        const batchId = job.active_job?.batch_id ?? job.batch_id;
        await completeBatchDelivery(driver.tankerId, batchId);
      } else {
        await completePriorityDelivery(driver.tankerId);
      }

      setJob(null);
      setCurrentStop(null);
      setStep("available");
      setOffer(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }, [driver, job]);

  const markCompletedAsAvailable = useCallback(() => {
    setStep("available");
    setOffer(null);
  }, []);

  const titles: Record<FlowStep, string> = {
    auth: "Driver Sign In",
    offline: "Driver",
    available: "Driver",
    incoming: "Incoming Offer",
    loading: "Load Tanker",
    delivering: "Delivery Run",
    completed: "Job Complete",
  };

  return {
    driver,
    online,
    step,
    offer,
    job,
    currentStop,
    loading,
    actionLoading,
    error,
    titles,
    setError,
    setStep,
    back,
    goRoleHome,
    pollOffer,
    pollJob,
    toggleOnline,
    handleAuthComplete,
    handleAcceptOffer,
    handleRejectOffer,
    handleLoaded,
    handleCompleteJob,
    markCompletedAsAvailable,
  };
}
