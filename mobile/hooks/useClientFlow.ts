// src/client/hooks/useClientFlow.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  BATCH_PRICE_PER_LITER,
  PRIORITY_PRICE_PER_LITER,
} from "@/constants/water";

import type {
  ClientStep,
  CurrentUser,
  PriorityMode,
  RequestMode,
} from "@/types/client";

import {
  confirmPayment,
  createWaterRequest,
  getBatchLive,
  getPriorityRequestLive,
  leaveBatchMember,
  type CreateRequestResponse,
} from "@/lib/api";


import {
  DEFAULT_LAT,
  DEFAULT_LNG,
  LIQUID_ID,
  POLL_INTERVAL_MS,
  ROLE_KEY,
} from "@/constants/clientConstants";



export function useClientFlow() {
  const [step, setStep] = useState<ClientStep | "auth">("auth");
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [mode, setMode] = useState<RequestMode>("batch");
  const [size, setSize] = useState<number | null>(null);
  const [priorityMode, setPriorityMode] = useState<PriorityMode>("asap");

  const [requestResp, setRequestResp] =
    useState<CreateRequestResponse | null>(null);

  const [liveData, setLiveData] = useState<any>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");



  const price =
    (size ?? 0) *
    (mode === "batch"
      ? BATCH_PRICE_PER_LITER
      : PRIORITY_PRICE_PER_LITER);

  const goRoleHome = useCallback(async () => {
    await AsyncStorage.removeItem(ROLE_KEY);
    router.replace("/");
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchLive = useCallback(async () => {
    if (!requestResp) return;

    try {
      setLiveLoading(true);

      if (requestResp.delivery_type === "batch" && requestResp.batch_id) {
        const data = await getBatchLive(
          requestResp.batch_id,
          requestResp.member_id ?? undefined
        );

        setLiveData(data);

        const batchStatus = data?.status ?? "";

        if (batchStatus === "completed") setStep("completed");
        else if (["delivering", "arrived"].includes(batchStatus))
          setStep("delivery");
        else if (["assigned", "loading"].includes(batchStatus))
          setStep("tanker");
      }

      if (requestResp.delivery_type === "priority" && requestResp.request_id) {
        const data = await getPriorityRequestLive(requestResp.request_id);

        setLiveData(data);

        const reqStatus = data?.status ?? "";

        if (reqStatus === "completed") setStep("completed");
        else if (["delivering", "arrived"].includes(reqStatus))
          setStep("delivery");
        else if (["assigned", "loading"].includes(reqStatus))
          setStep("tanker");
        else if (reqStatus === "failed") setStep("failed");
      }
    } catch {
      // polling should not crash UI
    } finally {
      setLiveLoading(false);
    }
  }, [requestResp]);

  useEffect(() => {
    const pollingSteps: Array<ClientStep | "auth"> = [
      "batch",
      "tanker",
      "delivery",
    ];

    if (pollingSteps.includes(step) && requestResp) {
      fetchLive();
      pollRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);
    } else {
      stopPolling();
    }

    return stopPolling;
  }, [step, requestResp, fetchLive, stopPolling]);

  const handleAuthComplete = (u: CurrentUser) => {
    setUser(u);
    setStep("request");
  };

  const handleSubmitRequest = async () => {
    if (!user || !size) return;

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
        is_asap: mode === "priority" ? priorityMode === "asap" : undefined,
      });

      setRequestResp(resp);
      setStep("payment");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!requestResp?.member_id) {
      setStep(mode === "batch" ? "batch" : "tanker");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await confirmPayment(requestResp.member_id);
      setStep(mode === "batch" ? "batch" : "tanker");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

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
            goRoleHome();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const back = () => {
    if (step === "auth") return router.back();
    if (step === "request") return router.back();
    if (step === "payment") return setStep("request");

    goRoleHome();
  };

  const titles: Record<string, string> = {
    auth: "Sign In",
    request: "Request Water",
    payment: "Payment",
    batch: "Batch Joined",
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
    liveData,
    liveLoading,
    loading,
    error,
    price,

    back,
    goRoleHome,
    fetchLive,
    handleAuthComplete,
    handleSubmitRequest,
    handleConfirmPayment,
    handleLeave,
    setStep,
    scheduledFor,
    setScheduledFor,
  };
}