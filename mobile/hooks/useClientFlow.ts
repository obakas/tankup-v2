// src/client/hooks/useClientFlow.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { toast } from "@/lib/toast";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppStatePause } from "@/hooks/useAppStatePause";

import {
  BATCH_PRICE_PER_LITER,
  PRIORITY_FULL_TANKER_PRICE,
  PLATFORM_BATCH_COMMISSION_RATE,
  PLATFORM_PRIORITY_COMMISSION_RATE,
} from "@/constants/water";

import type {
  ClientStep,
  CurrentUser,
  PriorityMode,
  RequestMode,
} from "@/types/client";

import {
  createWaterRequest,
  getBatchLive,
  getPriorityRequestLive,
  leaveBatchMember,
  listUserSites,
  updatePushToken,
  type CreateRequestResponse,
  type SiteProfileResponse,
} from "@/lib/api";
import { registerForPushNotificationsAsync } from "@/hooks/usePushNotifications";


import {
  DEFAULT_LAT,
  DEFAULT_LNG,
  LIQUID_ID,
  POLL_INTERVAL_MS,
  ROLE_KEY,
} from "@/constants/clientConstants";

const CLIENT_USER_KEY = "water_user";
const CLIENT_FLOW_KEY = "tankup_client_flow";

type ClientFlowSession = {
  user: CurrentUser | null;
  step: ClientStep | "auth";
  mode: RequestMode;
  size: number | null;
  priorityMode: PriorityMode;
  scheduledFor: string;
  requestResp: CreateRequestResponse | null;
  otp: string;
};

const CLIENT_STATUS_MESSAGES: Record<string, string> = {
  assigned: "Tanker assigned — loading water",
  loading: "Tanker loading water",
  delivering: "Tanker en route to you",
  en_route: "Tanker en route to you",
  arrived: "Tanker has arrived!",
  measuring: "Water measurement started",
  awaiting_otp: "OTP needed — check your screen",
  completed: "Delivery complete!",
  delivered: "Delivery complete!",
  partially_completed: "Delivery partially completed",
  failed: "Delivery failed — contact support",
  expired: "Batch expired",
};



export function useClientFlow() {
  const [step, setStep] = useState<ClientStep | "auth">("auth");
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [mode, setMode] = useState<RequestMode>("batch");
  const [size, setSize] = useState<number | null>(null);
  const [priorityMode, setPriorityMode] = useState<PriorityMode>("asap");

  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [userSites, setUserSites] = useState<SiteProfileResponse[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);

  const [requestResp, setRequestResp] =
    useState<CreateRequestResponse | null>(null);

  const [otp, setOtp] = useState<string>("");
  const [liveData, setLiveData] = useState<any>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<string>("");
  const [scheduledFor, setScheduledFor] = useState("");

  // Tracks whether the initial AsyncStorage hydration has completed. The
  // persistence effect must not write before hydration so it doesn't
  // overwrite a saved session with the default empty state.
  const hydratedRef = useRef(false);

  // ── Session hydration ─────────────────────────────────────────────────────

  useEffect(() => {
    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(CLIENT_FLOW_KEY);
        if (!raw) return;

        const session: ClientFlowSession = JSON.parse(raw);

        if (session.user) setUser(session.user);
        if (session.mode) setMode(session.mode);
        if (session.size != null) setSize(session.size);
        if (session.priorityMode) setPriorityMode(session.priorityMode);
        if (session.scheduledFor) setScheduledFor(session.scheduledFor);
        if (session.requestResp) setRequestResp(session.requestResp);
        if (session.otp) setOtp(session.otp);

        // Only restore a mid-flow step so we don't re-enter a terminal state
        const restorable: Array<ClientStep | "auth"> = [
          "request", "payment", "batch", "searching", "tanker", "delivery",
        ];
        if (session.step && restorable.includes(session.step)) {
          // Require a user to be present before restoring past "request"
          const needsUser: Array<ClientStep | "auth"> = [
            "payment", "batch", "searching", "tanker", "delivery",
          ];
          if (needsUser.includes(session.step) && !session.user) {
            setStep("request");
          } else {
            setStep(session.step);
          }
        }
      } catch {
        // Corrupted session — start fresh
      } finally {
        hydratedRef.current = true;
      }
    }

    hydrate();
  }, []);

  // ── Session persistence ───────────────────────────────────────────────────

  useEffect(() => {
    if (!hydratedRef.current) return;

    const session: ClientFlowSession = {
      user,
      step,
      mode,
      size,
      priorityMode,
      scheduledFor,
      requestResp,
      otp,
    };

    AsyncStorage.setItem(CLIENT_FLOW_KEY, JSON.stringify(session)).catch(() => {});
  }, [user, step, mode, size, priorityMode, scheduledFor, requestResp, otp]);

  // ── OTP sync from live data ───────────────────────────────────────────────

  useEffect(() => {
    const batchOtp =
      liveData?.member_delivery_code ?? liveData?.delivery_code ?? liveData?.otp;
    if (mode === "batch" && batchOtp) setOtp(batchOtp);
  }, [liveData?.member_delivery_code, liveData?.delivery_code, liveData?.otp, mode]);

  useEffect(() => {
    if (mode === "priority" && liveData?.otp) setOtp(liveData.otp);
  }, [liveData?.otp, mode]);

  // ─────────────────────────────────────────────────────────────────────────

  const price =
    mode === "priority"
      ? PRIORITY_FULL_TANKER_PRICE + PRIORITY_FULL_TANKER_PRICE * PLATFORM_PRIORITY_COMMISSION_RATE
      : (size ?? 0) * BATCH_PRICE_PER_LITER + (size ?? 0) * BATCH_PRICE_PER_LITER * PLATFORM_BATCH_COMMISSION_RATE;

  const goRoleHome = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(ROLE_KEY),
      AsyncStorage.removeItem(CLIENT_FLOW_KEY),
    ]);
    router.replace("/");
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Reset status baseline when a new request is made so the first poll doesn't fire a spurious toast.
  useEffect(() => {
    prevStatusRef.current = "";
  }, [requestResp]);

  const fetchLive = useCallback(async () => {
    if (!requestResp) return;

    try {
      setLiveLoading(true);

      // requestResp.delivery_type is not included in the backend create response,
      // so we use the mode state (set before payment and stable thereafter).
      if (mode === "batch" && requestResp.batch_id) {
        const data = await getBatchLive(
          requestResp.batch_id,
          requestResp.member_id ?? undefined
        );

        setLiveData(data);
        setLiveError(null);

        const batchStatus = data?.status ?? "";
        const effectiveStatus = (data?.member_delivery_status as string) || batchStatus;

        if (effectiveStatus && effectiveStatus !== prevStatusRef.current) {
          const msg = CLIENT_STATUS_MESSAGES[effectiveStatus];
          if (msg && prevStatusRef.current !== "") toast.info(msg);
          prevStatusRef.current = effectiveStatus;
        }

        if (["completed", "partially_completed"].includes(batchStatus)) setStep("completed");
        else if (["delivering", "arrived"].includes(batchStatus)) setStep("delivery");
        else if (["assigned", "loading"].includes(batchStatus)) setStep("tanker");
        else if (["failed", "expired", "assignment_failed"].includes(batchStatus)) setStep("failed");

        if (data?.otp) setOtp(data.otp);
      }

      if (mode === "priority" && requestResp.request_id) {
        const data = await getPriorityRequestLive(requestResp.request_id);

        setLiveData(data);
        setLiveError(null);

        const reqStatus = data?.request_status ?? "";

        if (reqStatus && reqStatus !== prevStatusRef.current) {
          const msg = CLIENT_STATUS_MESSAGES[reqStatus];
          if (msg && prevStatusRef.current !== "") toast.info(msg);
          prevStatusRef.current = reqStatus;
        }

        if (data?.otp) setOtp(data.otp);

        // "assigned" and "loading" stay on the "searching" step so the user
        // sees driver info and loading state on the "Finding Tanker" screen.
        // Only move forward once the tanker is actively delivering.
        if (["completed", "partially_completed"].includes(reqStatus)) setStep("completed");
        else if (["delivering", "arrived"].includes(reqStatus)) setStep("delivery");
        else if (reqStatus === "failed") setStep("failed");
      }
    } catch (e: any) {
      setLiveError(e?.message ?? "Could not refresh status");
    } finally {
      setLiveLoading(false);
    }
  }, [requestResp, mode]);

  const POLLING_STEPS: Array<ClientStep | "auth"> = ["batch", "searching", "tanker", "delivery"];

  useEffect(() => {
    if (POLLING_STEPS.includes(step) && requestResp) {
      fetchLive();
      pollRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);
    } else {
      stopPolling();
    }

    return stopPolling;
  }, [step, requestResp, fetchLive, stopPolling]);

  const restartPolling = useCallback(() => {
    stopPolling();
    if (POLLING_STEPS.includes(step) && requestResp) {
      fetchLive();
      pollRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);
    }
  }, [step, requestResp, fetchLive, stopPolling]);

  useAppStatePause(stopPolling, restartPolling);

  const loadSites = useCallback(async (userId: number) => {
    setLoadingSites(true);
    try {
      const sites = await listUserSites(userId);
      setUserSites(sites);
    } catch {
      // non-critical — user can still proceed
    } finally {
      setLoadingSites(false);
    }
  }, []);

  const handleAuthComplete = (u: CurrentUser) => {
    setUser(u);
    setStep("request");
    loadSites(u.id);
    toast.success(`Welcome, ${u.name}!`);
    AsyncStorage.setItem(CLIENT_USER_KEY, JSON.stringify(u)).catch(() => {});
    registerForPushNotificationsAsync().then((token) => {
      if (token) updatePushToken(u.id, token).catch(() => {});
    });
  };

  const handleSubmitRequest = () => {
    if (!user || !size || !selectedSiteId) return;
    setStep("payment");
  };

  const handleConfirmPayment = async () => {
    if (!user || !size || !selectedSiteId) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await createWaterRequest({
        user_id: user.id,
        liquid_id: LIQUID_ID,
        volume_liters: size,
        latitude: DEFAULT_LAT,
        longitude: DEFAULT_LNG,
        delivery_type: mode,
        site_profile_id: selectedSiteId,
        is_asap: mode === "priority" ? priorityMode === "asap" : undefined,
        scheduled_for:
          mode === "priority" && priorityMode === "scheduled" ? scheduledFor : undefined,
      });

      setRequestResp(resp);
      toast.success(
        mode === "batch"
          ? "Payment confirmed — batch request created!"
          : "Priority request confirmed!"
      );
      setStep(mode === "batch" ? "batch" : "searching");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryConfirmed = () => {
    toast.success("Delivery confirmed! Thank you.");
    setStep("completed");
  };

  const handleCancelBeforePayment = () => {
    setRequestResp(null);
    setSize(null);
    setMode("batch");
    setPriorityMode("asap");
    setScheduledFor("");
    setSelectedSiteId(null);
    toast.success("Request cancelled before payment");
    setStep("request");
  };

  const handleStartNewRequest = useCallback(() => {
    setRequestResp(null);
    setSize(null);
    setMode("batch");
    setPriorityMode("asap");
    setScheduledFor("");
    setSelectedSiteId(null);
    setOtp("");
    setLiveData(null);
    setLiveError(null);
    setError(null);
    setStep("request");
  }, []);

  const handleLeave = async () => {
    if (!requestResp?.member_id) return;

    Alert.alert("Leave Batch", "Are you sure you want to leave this batch?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setLoading(true);

          try {
            await leaveBatchMember(requestResp.member_id!);
            toast.success("You left the batch. Your payment was forfeited.");
            goRoleHome();
          } catch (e: any) {
            toast.error(e.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const back = () => {
    if (step === "auth") return goRoleHome();
    if (step === "request") return goRoleHome();
    if (step === "payment") return setStep("request");
    if (step === "completed" || step === "failed") return handleStartNewRequest();

    goRoleHome();
  };

  const titles: Record<string, string> = {
    auth: "Sign In",
    request: "Request Water",
    payment: "Payment",
    batch: "Batch Joined",
    searching: "Finding Tanker",
    tanker: "Tanker En Route",
    delivery: "Delivery in Progress",
    completed: "Delivered",
    expired: "Batch Expired",
    failed: "Delivery Failed",
    partial: "Partial Delivery",
  };

  return {
    step,
    titles,
    user,
    mode,
    setMode,
    size,
    setSize,
    priorityMode,
    setPriorityMode,
    requestResp,
    otp,
    liveData,
    liveLoading,
    liveError,
    loading,
    error,
    price,

    selectedSiteId,
    setSelectedSiteId,
    userSites,
    loadingSites,
    loadSites,

    back,
    handleCancelBeforePayment,
    handleStartNewRequest,
    goRoleHome,
    fetchLive,
    handleAuthComplete,
    handleSubmitRequest,
    handleConfirmPayment,
    handleDeliveryConfirmed,
    handleLeave,
    setStep,
    setUser,
    scheduledFor,
    setScheduledFor,
  };
}
