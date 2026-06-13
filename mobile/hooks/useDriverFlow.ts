import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import type { DriverStep } from "@/types/driver";
import { useAppStatePause } from "@/hooks/useAppStatePause";
import { useLocationHeartbeat } from "@/hooks/useLocationHeartbeat";
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
  driverHeartbeat,
  DriverResponse,
  getCurrentJob,
  getCurrentStop,
  getIncomingOffer,
  markBatchLoaded,
  markBatchStartLoading,
  markPriorityLoaded,
  markPriorityStartLoading,
  rejectOffer,
  setDriverOnline,
  updateDriverPushToken,
} from "@/lib/api";
import { registerForPushNotificationsAsync } from "@/hooks/usePushNotifications";
import { fireLocalNotification, addNotificationArrivedListener } from "@/lib/localNotifications";

// Offer expiry window is 60s — 10s detection still leaves ~50s to respond.
const POLL_AVAILABLE_MS = 10_000;
// Loading takes up to 45 min — no reason to hammer the backend every 4s.
const POLL_LOADING_MS = 15_000;
// Active delivery needs responsive stop progression.
const POLL_DELIVERING_MS = 5_000;
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
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverIdRef = useRef<number | null>(null);
  const prevTankerStatusRef = useRef<string>("");

  const [showOfflineModal, setShowOfflineModal] = useState(false);

  const { triggerAlarm, cancelAlarm } = useDriverOfferAlarm();

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

  const goRoleHome = useCallback(async () => {
    if (driver) {
      stopPolling();
      stopHeartbeat();
      try {
        await setDriverOnline(driver.tankerId, false);
      } catch {
        // best-effort
      }
    }
    await AsyncStorage.removeItem(ROLE_KEY);
    router.replace("/");
  }, [driver, stopPolling, stopHeartbeat]);

  const back = useCallback(() => {
    goRoleHome();
  }, [goRoleHome]);

  const pollOffer = useCallback(async () => {
    if (!driver) return;

    try {
      const res = await getIncomingOffer(driver.tankerId);
      if (res.has_offer) {
        setOffer(res.offer);
        setStep("incoming");
        stopPolling();
        void triggerAlarm(res.offer?.offer_type ?? "batch");
        void fireLocalNotification(
          "New Job Offer",
          res.offer?.offer_type === "priority"
            ? "A priority delivery offer is waiting — tap to review."
            : "A batch delivery offer is waiting — tap to review.",
          { type: "job_offer" }
        );
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
      const prevStatus = prevTankerStatusRef.current;

      if (tankerStatus && tankerStatus !== prevStatus) {
        const msg = DRIVER_STATUS_MESSAGES[tankerStatus];
        if (msg && prevStatus !== "") toast.info(msg);
        prevTankerStatusRef.current = tankerStatus;
      }

      if (["available", "completed"].includes(tankerStatus)) {
        const wasDelivering = ["delivering", "arrived"].includes(prevStatus);
        prevTankerStatusRef.current = "";
        if (wasDelivering) {
          setStep("completed");
          stopPolling();
        } else {
          setStep("available");
          setJob(null);
          stopPolling();
          pollRef.current = setInterval(pollOffer, POLL_AVAILABLE_MS);
        }
      }
    } catch {
      // Keep screen stable while backend/network breathes.
    }
  }, [driver, pollOffer, stopPolling]);

  useEffect(() => {
    if (driver) driverIdRef.current = driver.tankerId;
  }, [driver]);

  // Immediately re-poll when a push notification arrives in foreground so the
  // driver doesn't have to wait for the next interval tick.
  const pollOfferRef = useRef(pollOffer);
  pollOfferRef.current = pollOffer;
  const pollJobRef = useRef(pollJob);
  pollJobRef.current = pollJob;
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    return addNotificationArrivedListener(() => {
      if (stepRef.current === "available") void pollOfferRef.current();
      else if (stepRef.current === "loading" || stepRef.current === "delivering") void pollJobRef.current();
    });
  }, []);

  useEffect(() => {
    stopPolling();
    stopHeartbeat();
    if (!driver || !online) return;

    if (step === "available") {
      pollRef.current = setInterval(pollOffer, POLL_AVAILABLE_MS);
    }

    if (step === "loading") {
      pollRef.current = setInterval(pollJob, POLL_LOADING_MS);
    }

    if (step === "delivering") {
      pollRef.current = setInterval(pollJob, POLL_DELIVERING_MS);
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
      pollRef.current = setInterval(pollOffer, POLL_AVAILABLE_MS);
    } else if (step === "loading") {
      pollJob();
      pollRef.current = setInterval(pollJob, POLL_LOADING_MS);
    } else if (step === "delivering") {
      pollJob();
      pollRef.current = setInterval(pollJob, POLL_DELIVERING_MS);
    }
    if (step === "delivering") startHeartbeat();
  }, [driver, online, step, pollOffer, pollJob, stopPolling, stopHeartbeat, startHeartbeat]);

  useAppStatePause(stopPolling, restartPolling);

  useLocationHeartbeat({
    tankerId: driver?.tankerId ?? null,
    enabled: online && step !== "offline" && step !== "auth",
    onLocationUpdate: (latitude, longitude) => setDriverLocation({ latitude, longitude }),
  });

  const refreshJob = useCallback(async (d: DriverResponse) => {
    setLoading(true);

    try {
      const res = await getCurrentStop(d.tankerId);
      setCurrentStop(res);

      const tankerStatus = res?.tanker?.status ?? res?.tanker_status ?? "";
      prevTankerStatusRef.current = tankerStatus; // baseline — suppress toast on initial restore

      if (["assigned", "loading"].includes(tankerStatus)) {
        // getCurrentStop returns a different shape that lacks active_job; fetch proper job data
        const jobRes = await getCurrentJob(d.tankerId);
        setJob(jobRes);
        setStep("loading");
      } else if (["delivering", "arrived"].includes(tankerStatus)) {
        setJob(res);
        setStep("delivering");
      } else {
        setStep("available");
      }
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

      registerForPushNotificationsAsync().then((token) => {
        if (token) updateDriverPushToken(d.tankerId, token).catch(() => {});
      }).catch(() => {});

      if (["assigned", "loading", "delivering", "arrived"].includes(d.status)) {
        refreshJob(d);
      } else if (!d.is_online) {
        setStep("offline");
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
      if (!val && (step === "delivering" || step === "loading")) {
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

  const handleStartLoading = useCallback(async () => {
    if (!driver || !job) return;

    setActionLoading(true);
    setError(null);

    try {
      if (job.assignment_type === "batch" || job.active_job?.batch_id) {
        const batchId = job.active_job?.batch_id ?? job.batch_id;
        await markBatchStartLoading(driver.tankerId, batchId);
      } else {
        const requestId = job.active_job?.request_id ?? job.request_id;
        await markPriorityStartLoading(driver.tankerId, requestId);
      }
      const jobRes = await getCurrentJob(driver.tankerId);
      setJob(jobRes);
      toast.success("Loading started");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }, [driver, job]);

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
      if (job.assignment_type === "batch" || job.active_job?.batch_id) {
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

  const markCompletedAsAvailable = useCallback(() => {
    setStep("available");
    setOffer(null);
    setJob(null);
    stopPolling();
    if (driverIdRef.current) {
      pollRef.current = setInterval(pollOffer, POLL_AVAILABLE_MS);
    }
  }, [stopPolling, pollOffer]);

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
    driverLocation,
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
    handleStartLoading,
    handleLoaded,
    markCompletedAsAvailable,
    setDriver,
  };
}
