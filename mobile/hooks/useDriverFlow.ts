import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import type { DriverStep } from "@/types/driver";
import { useAppStatePause } from "@/hooks/useAppStatePause";
import { useLocationHeartbeat } from "@/hooks/useLocationHeartbeat";
import { toast } from "@/lib/toast";
import { useDriverOfferAlarm } from "@/hooks/useDriverOfferAlarm";

const DRIVER_STATUS_MESSAGES: Record<string, string> = {
  assigned: "Offer accepted — join the queue to load",
  queued: "You're in the queue — get ready to load",
  loading: "Tanker loading — prepare for departure",
  delivering: "Delivery run in progress",
  arrived: "You have arrived at the delivery point",
  completed: "All deliveries complete",
};
import {
  acceptOffer,
  acknowledgeCompletion,
  driverHeartbeat,
  DriverResponse,
  getCurrentJob,
  getCurrentStop,
  getIncomingOffer,
  markBatchJoinQueue,
  markBatchLoaded,
  markBatchStartLoading,
  markPriorityJoinQueue,
  markPriorityLoaded,
  markPriorityStartLoading,
  rejectOffer,
  setDriverOnline,
  updateDriverPushToken,
} from "@/lib/api";
import { registerForPushNotificationsAsync } from "@/hooks/usePushNotifications";
import { fireLocalNotification, addNotificationArrivedListener } from "@/lib/localNotifications";
import { Alert } from "react-native";
import { promptRingPermissionsOnce, stopRingNotification, consumeRingBackgroundDebug } from "@/lib/ringNotification";
import * as offerSocket from "@/lib/offerSocket";

// Primary offer detection is the WebSocket in offerSocket.ts (near-instant).
// This is just the backstop poll in case the socket dies silently — offer
// expiry window is 60s, so this alone would be too slow to rely on solo.
const POLL_AVAILABLE_BACKSTOP_MS = 45_000;
// Loading takes up to 45 min — no reason to hammer the backend every 4s.
const POLL_LOADING_MS = 15_000;
// Active delivery needs responsive stop progression.
const POLL_DELIVERING_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const ROLE_KEY = "tankup_active_role";
const DRIVER_AUTH_KEY = "driver_auth"; // must match app/index.tsx and tasks/locationTask.ts

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
  // Tracks whether the initial AsyncStorage hydration has completed. The
  // is_online persistence effect must not write before hydration so it
  // doesn't overwrite a saved session with the default empty state.
  const hydratedRef = useRef(false);

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
    offerSocket.disconnect();
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

  const signOut = useCallback(async () => {
    if (driver) {
      stopPolling();
      stopHeartbeat();
      try {
        await setDriverOnline(driver.tankerId, false);
      } catch {
        // best-effort
      }
    }
    await AsyncStorage.multiRemove([ROLE_KEY, DRIVER_AUTH_KEY]);
    router.replace("/");
  }, [driver, stopPolling, stopHeartbeat]);

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

  // Opens the offer push channel and a slow backstop poll for the "available"
  // step. Called explicitly (not left to the step-driven effect below) at
  // every entry point into "available", since some of those entries (e.g.
  // refreshJob re-confirming the same status after an app resume) set step
  // to a value React sees as unchanged, which would silently skip the effect.
  const startAvailableWatch = useCallback(() => {
    if (!driver) return;
    offerSocket.connect(driver.tankerId, () => {
      void pollOffer();
    });
    pollRef.current = setInterval(pollOffer, POLL_AVAILABLE_BACKSTOP_MS);
  }, [driver, pollOffer]);

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

      if (tankerStatus === "completed") {
        prevTankerStatusRef.current = "";
        setStep("completed");
        stopPolling();
      } else if (tankerStatus === "available") {
        prevTankerStatusRef.current = "";
        setStep("available");
        setJob(null);
        stopPolling();
        startAvailableWatch();
      }
    } catch {
      // Keep screen stable while backend/network breathes.
    }
  }, [driver, stopPolling, startAvailableWatch]);

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
      else if (
        stepRef.current === "assigned" ||
        stepRef.current === "queued" ||
        stepRef.current === "loading" ||
        stepRef.current === "delivering"
      )
        void pollJobRef.current();
    });
  }, []);

  useEffect(() => {
    stopPolling();
    stopHeartbeat();
    if (!driver || !online) return;

    if (step === "available") {
      startAvailableWatch();
    }

    if (step === "assigned" || step === "queued") {
      pollRef.current = setInterval(pollJob, POLL_LOADING_MS);
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
  }, [driver, online, step, pollOffer, pollJob, stopPolling, stopHeartbeat, startHeartbeat, startAvailableWatch]);

  const refreshJob = useCallback(async (d: DriverResponse, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);

    try {
      const res = await getCurrentStop(d.tankerId);
      setCurrentStop(res);

      const tankerStatus = res?.tanker?.status ?? res?.tanker_status ?? "";
      prevTankerStatusRef.current = tankerStatus; // baseline — suppress toast on initial restore

      if (tankerStatus === "assigned") {
        // getCurrentStop returns a different shape that lacks active_job; fetch proper job data
        const jobRes = await getCurrentJob(d.tankerId);
        setJob(jobRes);
        setOffer(null);
        setStep("assigned");
      } else if (tankerStatus === "queued") {
        const jobRes = await getCurrentJob(d.tankerId);
        setJob(jobRes);
        setOffer(null);
        setStep("queued");
      } else if (tankerStatus === "loading") {
        const jobRes = await getCurrentJob(d.tankerId);
        setJob(jobRes);
        setOffer(null);
        setStep("loading");
      } else if (["delivering", "arrived"].includes(tankerStatus)) {
        // getCurrentStop returns a different shape that lacks active_job; fetch proper job data
        const jobRes = await getCurrentJob(d.tankerId);
        setJob(jobRes);
        setOffer(null);
        setStep("delivering");
      } else if (tankerStatus === "completed") {
        // Job finished but the driver hasn't tapped "Back Online" yet (e.g. the
        // app was backgrounded/killed right after the last stop) — show the
        // job-complete/earnings screen instead of skipping straight to available.
        const jobRes = await getCurrentJob(d.tankerId);
        setJob(jobRes);
        setOffer(null);
        setStep("completed");
      } else if (!d.is_online) {
        setStep("offline");
      } else {
        setStep("available");
        // Check immediately instead of waiting on the offer channel/backstop poll —
        // this is exactly the path a driver takes after tapping a job-offer notification.
        getIncomingOffer(d.tankerId).then((res) => {
          if (res.has_offer) {
            setOffer(res.offer);
            setStep("incoming");
            void triggerAlarm(res.offer?.offer_type ?? "batch");
          } else {
            // restartPolling (app-resume) routes through here rather than
            // re-arming directly, and setStep("available") above is a no-op
            // when the step was already "available" — so this call is what
            // actually reconnects the offer socket/backstop poll on resume.
            startAvailableWatch();
          }
        }).catch(() => {});
      }
    } catch {
      // Silent resume-refreshes must not clobber a good screen on a transient
      // network blip — same "polling stays quiet" rule as pollJob/pollOffer.
      if (!opts?.silent) setStep("available");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [triggerAlarm, startAvailableWatch]);

  const restartPolling = useCallback(() => {
    stopPolling();
    stopHeartbeat();
    if (!driver || !online) return;
    // Re-derive step from live backend truth rather than trusting whatever the
    // screen showed before backgrounding. An offer accepted/declined via the OS
    // ring notification's action buttons (mobile/lib/ringNotification.ts) runs
    // outside this hook entirely and never updates local state — without this,
    // a driver who accepts from a backgrounded/locked-screen notification comes
    // back to a stale "waiting for offer" screen that never shows the job.
    void refreshJob({ ...driver, is_online: online }, { silent: true });
  }, [driver, online, refreshJob]);

  useAppStatePause(stopPolling, restartPolling);

  useLocationHeartbeat({
    tankerId: driver?.tankerId ?? null,
    enabled: online && step !== "offline" && step !== "auth",
    onLocationUpdate: (latitude, longitude) => setDriverLocation({ latitude, longitude }),
  });

  const handleAuthComplete = useCallback(
    (d: DriverResponse) => {
      setDriver(d);
      setOnline(d.is_online);

      registerForPushNotificationsAsync().then(({ expoPushToken, fcmToken }) => {
        if (expoPushToken) updateDriverPushToken(d.tankerId, expoPushToken, fcmToken).catch(() => {});
        if (fcmToken) promptRingPermissionsOnce().catch(() => {});
      }).catch(() => {});

      // Temporary diagnostic — the FCM background handler (mobile/index.js) runs
      // with no UI of its own, so this is the only way to see whether it fired
      // at all without a device-connected debugger. Remove once the ring is
      // confirmed working end-to-end from a backgrounded/locked state.
      consumeRingBackgroundDebug().then((raw) => {
        if (raw) Alert.alert("Ring background debug", raw);
      }).catch(() => {});

      // Always resolve the step from live backend status rather than the
      // d.status snapshot cached at login — that field is never refreshed
      // as a job progresses, so trusting it here would strand a driver who
      // backs out mid-job on a stale "available" screen while their actual
      // job (assigned/loading/delivering) is invisible.
      refreshJob(d);
    },
    [refreshJob]
  );

  // Restore a persisted session on mount so navigating back into this screen
  // (e.g. via a tapped push notification, or simply reopening the app) doesn't
  // force a fresh login. Mirrors the hydration pattern in useClientFlow.ts.
  useEffect(() => {
    AsyncStorage.getItem(DRIVER_AUTH_KEY)
      .then((stored) => {
        if (!stored) return;
        try {
          handleAuthComplete(JSON.parse(stored));
        } catch {
          // corrupted session — fall through to the auth screen
        }
      })
      .finally(() => {
        hydratedRef.current = true;
      });
  }, [handleAuthComplete]);

  // Keep the persisted session's `is_online` in sync with live toggles
  // (toggleOnline, confirmOffline). Without this, a stale "offline" snapshot
  // from an earlier login would override the driver's real online status the
  // next time the session is restored — e.g. when reopening via a notification
  // after having gone online mid-session.
  useEffect(() => {
    if (!hydratedRef.current || !driver) return;
    AsyncStorage.setItem(DRIVER_AUTH_KEY, JSON.stringify({ ...driver, is_online: online })).catch(() => {});
  }, [driver, online]);

  const toggleOnline = useCallback(
    async (val: boolean) => {
      if (!driver) return;

      // If going offline during an active delivery, show the reason modal instead
      if (!val && (step === "delivering" || step === "loading" || step === "queued")) {
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
      void stopRingNotification(offer?.id);
      await acceptOffer(driver.tankerId);
      const jobRes = await getCurrentJob(driver.tankerId);
      setJob(jobRes);
      setCurrentStop(null);
      setOffer(null);
      setStep("assigned");
      toast.success("Offer accepted — join the queue to load!");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }, [driver, offer, cancelAlarm]);

  const handleJoinQueue = useCallback(async () => {
    if (!driver || !job) return;

    setActionLoading(true);
    setError(null);

    try {
      if (job.assignment_type === "batch" || job.active_job?.batch_id) {
        const batchId = job.active_job?.batch_id ?? job.batch_id;
        await markBatchJoinQueue(driver.tankerId, batchId);
      } else {
        const requestId = job.active_job?.request_id ?? job.request_id;
        await markPriorityJoinQueue(driver.tankerId, requestId);
      }
      const jobRes = await getCurrentJob(driver.tankerId);
      setJob(jobRes);
      setStep("queued");
      toast.success("You're in the queue.");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }, [driver, job]);

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
      setStep("loading");
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
      void stopRingNotification(offer?.id);
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
  }, [driver, offer, cancelAlarm]);

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
    if (driverIdRef.current) {
      acknowledgeCompletion(driverIdRef.current).catch(() => {});
    }
    setStep("available");
    setOffer(null);
    setJob(null);
    stopPolling();
    startAvailableWatch();
  }, [stopPolling, startAvailableWatch]);

  const titles: Record<FlowStep, string> = {
    auth: "Driver Sign In",
    offline: "Driver",
    available: "Driver",
    incoming: "Incoming Offer",
    assigned: "Assignment Received",
    queued: "In Queue to Load",
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
    signOut,
    pollOffer,
    pollJob,
    toggleOnline,
    confirmOffline,
    cancelOfflineModal,
    handleAuthComplete,
    handleAcceptOffer,
    handleRejectOffer,
    handleJoinQueue,
    handleStartLoading,
    handleLoaded,
    markCompletedAsAvailable,
    setDriver,
  };
}
