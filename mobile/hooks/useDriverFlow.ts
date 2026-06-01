import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import type { DriverStep } from "@/types/driver";
import { useAppStatePause } from "@/hooks/useAppStatePause";
import { toast } from "@/lib/toast";
import { useDriverOfferAlarm } from "@/hooks/useDriverOfferAlarm";

const DRIVER_STATUS_MESSAGES: Record<string, string> = {
  loading: "Tanker loading — prepare for departure",
  delivering: "Delivery run in progress",
  arrived: "You have arrived at the delivery point",
  completed: "All deliveries complete",
};
import {
  acceptOffer,
  completeBatchDelivery,
  completePriorityDelivery,
  driverHeartbeat,
  DriverResponse,
  getCurrentJob,
  getCurrentStop,
  getIncomingOffer,
  markBatchLoaded,
  markPriorityLoaded,
  rejectOffer,
  setDriverOnline,
} from "@/lib/api";

const POLL_INTERVAL_MS = 4000;
const HEARTBEAT_INTERVAL_MS = 30_000;
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
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverIdRef = useRef<number | null>(null);
  const prevTankerStatusRef = useRef<string>("");

  const [showOfflineModal, setShowOfflineModal] = useState(false);

  const { triggerAlarm, cancelAlarm } = useDriverOfferAlarm();

  const goRoleHome = useCallback(async () => {
    await AsyncStorage.removeItem(ROLE_KEY);
    router.replace("/");
  }, []);

  const back = useCallback(() => {
    goRoleHome();
  }, [goRoleHome]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    if (!driverIdRef.current) return;
    const id = driverIdRef.current;
    heartbeatRef.current = setInterval(() => {
      driverHeartbeat(id).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
  }, [stopHeartbeat]);

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
        void triggerAlarm(res.offer?.offer_type ?? "batch");
      }
    } catch {
      // Polling should be quiet. One bad request must not break the driver screen.
    }
  }, [driver, stopPolling, triggerAlarm]);

  const pollJob = useCallback(async () => {
    if (!driver) return;

    try {
      const res = await getCurrentStop(driver.tankerId);
      setCurrentStop(res);

      const tankerStatus = res?.tanker?.status ?? res?.tanker_status ?? "";

      if (tankerStatus && tankerStatus !== prevTankerStatusRef.current) {
        const msg = DRIVER_STATUS_MESSAGES[tankerStatus];
        if (msg && prevTankerStatusRef.current !== "") toast.info(msg);
        prevTankerStatusRef.current = tankerStatus;
      }

      if (["available", "completed"].includes(tankerStatus)) {
        prevTankerStatusRef.current = "";
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
    if (driver) driverIdRef.current = driver.tankerId;
  }, [driver]);

  useEffect(() => {
    stopPolling();
    stopHeartbeat();
    if (!driver || !online) return;

    if (step === "available") {
      pollRef.current = setInterval(pollOffer, POLL_INTERVAL_MS);
    }

    if (["loading", "delivering"].includes(step)) {
      pollRef.current = setInterval(pollJob, POLL_INTERVAL_MS);
    }

    if (step === "delivering") {
      startHeartbeat();
    }

    return () => {
      stopPolling();
      stopHeartbeat();
    };
  }, [driver, online, step, pollOffer, pollJob, stopPolling, stopHeartbeat, startHeartbeat]);

  const restartPolling = useCallback(() => {
    stopPolling();
    stopHeartbeat();
    if (!driver || !online) return;
    if (step === "available") {
      pollOffer();
      pollRef.current = setInterval(pollOffer, POLL_INTERVAL_MS);
    } else if (["loading", "delivering"].includes(step)) {
      pollJob();
      pollRef.current = setInterval(pollJob, POLL_INTERVAL_MS);
    }
    if (step === "delivering") startHeartbeat();
  }, [driver, online, step, pollOffer, pollJob, stopPolling, stopHeartbeat, startHeartbeat]);

  useAppStatePause(stopPolling, restartPolling);

  const refreshJob = useCallback(async (d: DriverResponse) => {
    setLoading(true);

    try {
      const res = await getCurrentStop(d.tankerId);
      setCurrentStop(res);
      setJob(res);

      const tankerStatus = res?.tanker?.status ?? res?.tanker_status ?? "";
      prevTankerStatusRef.current = tankerStatus; // baseline — suppress toast on initial restore
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

      // If going offline during an active delivery, show the reason modal instead
      if (!val && step === "delivering") {
        setShowOfflineModal(true);
        return;
      }

      setOnline(val);

      if (!val) {
        stopPolling();
        stopHeartbeat();
        setStep("offline");
      } else {
        setStep("available");
      }

      try {
        await setDriverOnline(driver.tankerId, val);
      } catch {
        // Don't punish the UI for a sync failure.
      }
    },
    [driver, step, stopPolling, stopHeartbeat]
  );

  const confirmOffline = useCallback(
    async (reason: string) => {
      if (!driver) return;
      setShowOfflineModal(false);
      setOnline(false);
      stopPolling();
      stopHeartbeat();
      setStep("offline");
      try {
        await setDriverOnline(driver.tankerId, false, reason);
      } catch {
        // Don't punish the UI for a sync failure.
      }
    },
    [driver, stopPolling, stopHeartbeat]
  );

  const cancelOfflineModal = useCallback(() => {
    setShowOfflineModal(false);
  }, []);

  const handleAcceptOffer = useCallback(async () => {
    if (!driver) return;

    setActionLoading(true);
    setError(null);

    try {
      void cancelAlarm();
      await acceptOffer(driver.tankerId);
      const jobRes = await getCurrentJob(driver.tankerId);
      setJob(jobRes);
      setCurrentStop(null);
      setStep("loading");
      toast.success("Offer accepted — start loading!");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }, [driver, cancelAlarm]);

  const handleRejectOffer = useCallback(async () => {
    if (!driver) return;

    setActionLoading(true);
    setError(null);

    try {
      void cancelAlarm();
      await rejectOffer(driver.tankerId);
      setOffer(null);
      setStep("available");
      toast.success("Offer declined");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }, [driver, cancelAlarm]);

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
      toast.success("Tanker loaded — begin deliveries");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
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
      toast.success("Job complete — well done!");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
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
    showOfflineModal,
    setError,
    setStep,
    back,
    goRoleHome,
    pollOffer,
    pollJob,
    toggleOnline,
    confirmOffline,
    cancelOfflineModal,
    handleAuthComplete,
    handleAcceptOffer,
    handleRejectOffer,
    handleLoaded,
    handleCompleteJob,
    markCompletedAsAvailable,
    setDriver,
  };
}
