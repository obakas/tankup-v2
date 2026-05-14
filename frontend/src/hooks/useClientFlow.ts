import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ClientStep, RequestMode } from "@/types/client";
import {
  BATCH_PRICE_PER_LITER,
  PRIORITY_FULL_TANKER_PRICE,
  PLATFORM_PRIORITY_COMMISSION_RATE,
  PLATFORM_BATCH_COMMISSION_RATE,
} from "@/constants/water";
import { useLiveBatch } from "@/hooks/useLiveBatch";
// import { createWaterRequest, type UserResponse } from "@/lib/api";
import {
  createWaterRequest,
  confirmPayment,
  type UserResponse,
} from "@/lib/api";
import { leaveBatchMember } from "@/lib/batches";
import { useLivePriorityRequest } from "@/hooks/useLivePriorityRequest";
import { fetchActivePriorityRequest } from "@/lib/requests";

interface UseClientFlowParams {
  onBack: () => void;
}

type AuthMode = "signup" | "login";

interface ClientSession {
  requestId: number | null;
  batchId: number | null;
  memberId: number | null;
  paymentDeadline: string | null;
  requestMode: RequestMode;
  selectedSize: number | null;
  priorityMode: "asap" | "scheduled";
  scheduledFor: string;
  otp: string;
}

interface RequestResponseWithOtp {
  request_id?: number | null;
  batch_id?: number | null;
  member_id?: number | null;
  payment_deadline?: string | null;
  delivery_code?: string | null;
}

const CLIENT_SESSION_KEY = "water_client_session";
const USER_KEY = "water_user";

const ABUJA_ASOKORO_FALLBACK = { latitude: 9.0580, longitude: 7.5233 };

async function getClientCoordinates(): Promise<{ latitude: number; longitude: number }> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return ABUJA_ASOKORO_FALLBACK;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve(ABUJA_ASOKORO_FALLBACK),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export const useClientFlow = ({ onBack }: UseClientFlowParams) => {
  const [step, setStep] = useState<ClientStep>("request");
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [requestMode, setRequestMode] = useState<RequestMode>("batch");
  const [priorityMode, setPriorityMode] = useState<"asap" | "scheduled">("asap");
  const [scheduledFor, setScheduledFor] = useState<string>("");

  const [showHelp, setShowHelp] = useState(false);
  const [showLeaveBatchWarning, setShowLeaveBatchWarning] = useState(false);
  const [otp, setOtp] = useState<string>("");

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [paymentDeadline, setPaymentDeadline] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [activeTab, setActiveTab] = useState<"request" | "history">("request");
  const [isRecoveringPriorityRequest, setIsRecoveringPriorityRequest] = useState(false);
  const {
    batch: liveBatch,
    isLoading: liveBatchLoading,
    error: liveBatchError,
    refresh: refreshLiveBatch,
  } = useLiveBatch(batchId, memberId, 8000);

  const {
    request: livePriorityRequest,
    isLoading: livePriorityLoading,
    error: livePriorityError,
    refresh: refreshLivePriorityRequest,
  } = useLivePriorityRequest(requestMode === "priority" ? requestId : null, 8000);

  function resolvePriorityClientStep(
    priorityRequest: ReturnType<typeof useLivePriorityRequest>["request"],
    fallbackStep: ClientStep
  ): ClientStep {
    if (!priorityRequest) return fallbackStep;

    const deliveryStatus = priorityRequest.delivery_status;
    const tankerStatus = priorityRequest.tanker_status;
    const requestStatus = priorityRequest.request_status;

    if (
      requestStatus === "failed" ||
      requestStatus === "expired" ||
      deliveryStatus === "failed" ||
      deliveryStatus === "skipped"
    ) {
      return "failed";
    }

    if (requestStatus === "partially_completed") {
      return "partial";
    }

    if (
      deliveryStatus === "delivered" ||
      requestStatus === "completed" ||
      priorityRequest.customer_confirmed
    ) {
      return "completed";
    }

    if (
      deliveryStatus === "arrived" ||
      deliveryStatus === "measuring" ||
      deliveryStatus === "awaiting_otp"
    ) {
      return "delivery";
    }

    if (
      deliveryStatus === "pending" ||
      deliveryStatus === "en_route" ||
      tankerStatus === "assigned" ||
      tankerStatus === "loading" ||
      tankerStatus === "delivering" ||
      tankerStatus === "arrived"
    ) {
      return "tanker";
    }

    return fallbackStep;
  }

  function resolveClientStep(
    batch: typeof liveBatch,
    fallbackStep: ClientStep
  ): ClientStep {
    if (!batch) return fallbackStep;

    const status = batch.status;
    const memberDeliveryStatus = batch.member_delivery_status as
      | "arrived"
      | "pending"
      | "en_route"
      | "measuring"
      | "awaiting_otp"
      | "delivered"
      | "failed"
      | "skipped"
      | null;

    if (memberDeliveryStatus === "failed" || memberDeliveryStatus === "skipped") {
      return "failed";
    }

    if (memberDeliveryStatus === "delivered") {
      return "completed";
    }

    if (["arrived", "measuring", "awaiting_otp"].includes(memberDeliveryStatus ?? "")) {
      return "delivery";
    }

    if (["forming", "near_ready", "ready_for_assignment"].includes(status)) {
      return "batch";
    }

    if (["assigned", "loading"].includes(status)) {
      return "tanker";
    }

    if (status === "delivering" || status === "arrived") {
      return memberDeliveryStatus === "en_route" || memberDeliveryStatus === "pending"
        ? "tanker"
        : "delivery";
    }

    if (status === "completed") {
      return "completed";
    }

    // if (status === "partially_completed") {
    //   return memberDeliveryStatus === "delivered" ? "completed" : "partial";
    // }

    if (status === "failed") {
      return "failed";
    }

    if (status === "expired") {
      return "expired";
    }

    return fallbackStep;
  }

  const resolvedStep = useMemo(() => {
    if (requestMode === "batch") {
      return resolveClientStep(liveBatch, step);
    }

    return resolvePriorityClientStep(livePriorityRequest, step);
  }, [requestMode, liveBatch, livePriorityRequest, step]);

  const price = useMemo(() => {
    if (requestMode === "priority") {
      return (
        PRIORITY_FULL_TANKER_PRICE +
        PRIORITY_FULL_TANKER_PRICE * PLATFORM_PRIORITY_COMMISSION_RATE
      );
    }

    if (!selectedSize) return 0;

    return (
      selectedSize * BATCH_PRICE_PER_LITER +
      selectedSize * BATCH_PRICE_PER_LITER * PLATFORM_BATCH_COMMISSION_RATE
    );
  }, [requestMode, selectedSize]);

  const canContinueToPayment = useMemo(() => {
    if (!selectedSize) return false;
    if (requestMode === "batch") return true;
    if (priorityMode === "asap") return true;
    return !!scheduledFor;
  }, [selectedSize, requestMode, priorityMode, scheduledFor]);

  useEffect(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    if (!savedUser) return;

    try {
      const parsedUser: UserResponse = JSON.parse(savedUser);
      setCurrentUser(parsedUser);
      void recoverActivePriorityRequest(parsedUser);
    } catch {
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  useEffect(() => {
    const savedSession = localStorage.getItem(CLIENT_SESSION_KEY);
    if (!savedSession) return;

    try {
      const parsed: ClientSession = JSON.parse(savedSession);

      setRequestId(parsed.requestId ?? null);
      setBatchId(parsed.batchId ?? null);
      setMemberId(parsed.memberId ?? null);
      setPaymentDeadline(parsed.paymentDeadline ?? null);
      setRequestMode(parsed.requestMode ?? "batch");
      setSelectedSize(parsed.selectedSize ?? null);
      setPriorityMode(parsed.priorityMode ?? "asap");
      setScheduledFor(parsed.scheduledFor ?? "");
      setOtp(parsed.otp ?? "");

      if (parsed.requestMode === "batch" && parsed.batchId) {
        setStep("batch");
      } else if (parsed.requestMode === "priority" && parsed.requestId) {
        setStep("tanker");
      }
    } catch {
      localStorage.removeItem(CLIENT_SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (liveBatch?.otp) {
      setOtp(liveBatch.otp);
    }
  }, [liveBatch?.otp]);

  useEffect(() => {
    if (livePriorityRequest?.otp) {
      setOtp(livePriorityRequest.otp);
    }
  }, [livePriorityRequest?.otp]);

  useEffect(() => {
    const session: ClientSession = {
      requestId,
      batchId,
      memberId,
      paymentDeadline,
      requestMode,
      selectedSize,
      priorityMode,
      scheduledFor,
      otp,
    };

    const hasSessionData =
      !!requestId ||
      !!batchId ||
      !!memberId ||
      !!paymentDeadline ||
      !!selectedSize ||
      otp.length > 0;

    if (hasSessionData) {
      localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
    }
  }, [
    requestId,
    batchId,
    memberId,
    paymentDeadline,
    requestMode,
    selectedSize,
    priorityMode,
    scheduledFor,
    otp,
  ]);

  const copyOtp = async () => {
    if (!otp) {
      toast.error("No OTP available yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(otp);
      toast.success("OTP copied to clipboard");
    } catch {
      toast.error("Failed to copy OTP");
    }
  };

  const recoverActivePriorityRequest = async (user: UserResponse) => {
    try {
      setIsRecoveringPriorityRequest(true);

      const response = await fetchActivePriorityRequest(user.id);

      if (!response.has_active_priority || !response.request) {
        return;
      }

      const active = response.request;

      setRequestMode("priority");
      setRequestId(active.request_id);
      setBatchId(null);
      setMemberId(null);
      setPaymentDeadline(null);
      setPriorityMode(active.is_asap ? "asap" : "scheduled");
      setScheduledFor(active.scheduled_for ?? "");
      setSelectedSize(active.planned_liters ?? null);
      setOtp(active.otp ?? "");

      const recoveredSession: ClientSession = {
        requestId: active.request_id,
        batchId: null,
        memberId: null,
        paymentDeadline: null,
        requestMode: "priority",
        selectedSize: active.planned_liters ?? null,
        priorityMode: active.is_asap ? "asap" : "scheduled",
        scheduledFor: active.scheduled_for ?? "",
        otp: active.otp ?? "",
      };

      localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(recoveredSession));

      const nextStep = resolvePriorityClientStep(active, "tanker");
      setStep(nextStep);

      toast.success("Your active priority delivery has been restored.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not recover active priority request";
      console.warn(message);
    } finally {
      setIsRecoveringPriorityRequest(false);
    }
  };

  const handleContinueToPayment = () => {
    if (!canContinueToPayment) {
      toast.error("Please complete your request details first");
      return;
    }

    if (!currentUser) {
      setAuthMode("login");
      setShowAuthModal(true);
      return;
    }
    setStep("payment");
  };

  const handleAuthSuccess = (user: UserResponse) => {
    setCurrentUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setShowAuthModal(false);
    toast.success(`Welcome, ${user.name}!`);

    void recoverActivePriorityRequest(user);

    setStep("payment");
  };

  const resetClientFlow = () => {
    localStorage.removeItem(CLIENT_SESSION_KEY);
    setStep("request");
    setSelectedSize(null);
    setRequestMode("batch");
    setPriorityMode("asap");
    setScheduledFor("");
    setShowHelp(false);
    setShowLeaveBatchWarning(false);
    setOtp("");
    setIsSubmittingRequest(false);
    setRequestId(null);
    setBatchId(null);
    setMemberId(null);
    setPaymentDeadline(null);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(USER_KEY);
    toast.success("Logged out");
    resetClientFlow();
  };

  const goBack = () => {
    if (resolvedStep === "request") {
      onBack();
      return;
    }

    if (resolvedStep === "payment") {
      setStep("request");
      return;
    }

    if (resolvedStep === "batch") {
      setStep("payment");
      return;
    }

    if (resolvedStep === "tanker") {
      setStep(requestMode === "batch" ? "batch" : "payment");
      return;
    }

    if (resolvedStep === "delivery") {
      setStep("tanker");
      return;
    }

    if (["completed", "failed", "partial"].includes(resolvedStep)) {
      setStep("delivery");
      return;
    }

    if (resolvedStep === "expired") {
      setStep("batch");
    }
  };



  const handlePayment = async () => {
    if (!selectedSize) {
      toast.error("Please select a tank size");
      return;
    }

    if (
      requestMode === "priority" &&
      priorityMode === "scheduled" &&
      !scheduledFor
    ) {
      toast.error("Please select an exact delivery date and time");
      return;
    }

    if (!currentUser) {
      toast.error("Please sign up or log in before making payment");
      setAuthMode("signup");
      setShowAuthModal(true);
      return;
    }

    try {
      setIsSubmittingRequest(true);

      const coords = await getClientCoordinates();

      const payload = {
        user_id: currentUser.id,
        liquid_id: 1,
        volume_liters: selectedSize,
        latitude: coords.latitude,
        longitude: coords.longitude,
        delivery_type: requestMode,
        ...(requestMode === "priority"
          ? priorityMode === "asap"
            ? { is_asap: true }
            : { is_asap: false, scheduled_for: scheduledFor }
          : {}),
      };

      const response = (await createWaterRequest(
        payload
      )) as RequestResponseWithOtp;

      const nextRequestId = response.request_id ?? null;
      const nextBatchId = response.batch_id ?? null;
      const nextMemberId = response.member_id ?? null;
      const nextPaymentDeadline = response.payment_deadline ?? null;
      const nextOtp = response.delivery_code ?? "";

      if (requestMode === "batch") {
        if (!nextMemberId) {
          throw new Error("Batch member ID missing from create request response");
        }

        // Simulate successful payment after request creation.
        // Backend will then promote batch / refresh state / trigger assignment.
        const paymentConfirmResponse = await confirmPayment(nextMemberId);

        const confirmedRequestId =
          (paymentConfirmResponse as any)?.request_id ?? nextRequestId;
        const confirmedBatchId =
          (paymentConfirmResponse as any)?.batch_id ?? nextBatchId;
        const confirmedMemberId =
          (paymentConfirmResponse as any)?.member_id ?? nextMemberId;
        const confirmedPaymentDeadline =
          (paymentConfirmResponse as any)?.payment_deadline ?? nextPaymentDeadline;
        const confirmedOtp =
          (paymentConfirmResponse as any)?.delivery_code ?? nextOtp;

        setRequestId(confirmedRequestId);
        setBatchId(confirmedBatchId);
        setMemberId(confirmedMemberId);
        setPaymentDeadline(confirmedPaymentDeadline);
        setOtp(confirmedOtp);

        const clientSession: ClientSession = {
          requestId: confirmedRequestId,
          batchId: confirmedBatchId,
          memberId: confirmedMemberId,
          paymentDeadline: confirmedPaymentDeadline,
          requestMode,
          selectedSize,
          priorityMode,
          scheduledFor,
          otp: confirmedOtp,
        };

        localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(clientSession));

        toast.success("Payment confirmed and batch request created!");
        setStep("batch");
        return;
      }

      // Priority path stays as request-create flow for now
      setRequestId(nextRequestId);
      setBatchId(nextBatchId);
      setMemberId(nextMemberId);
      setPaymentDeadline(nextPaymentDeadline);
      setOtp(nextOtp);

      const clientSession: ClientSession = {
        requestId: nextRequestId,
        batchId: nextBatchId,
        memberId: nextMemberId,
        paymentDeadline: nextPaymentDeadline,
        requestMode,
        selectedSize,
        priorityMode,
        scheduledFor,
        otp: nextOtp,
      };

      localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(clientSession));

      toast.success("Priority request created successfully!");
      setStep("tanker");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create request";
      toast.error(message);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCancelBeforePayment = () => {
    setSelectedSize(null);
    setPriorityMode("asap");
    setScheduledFor("");
    setRequestMode("batch");
    setOtp("");
    toast.success("Request cancelled before payment");
    setStep("request");
  };

  const handleLeaveBatch = async () => {
    if (!memberId) {
      toast.error("No batch membership found");
      return;
    }

    try {
      await leaveBatchMember(memberId);
      localStorage.removeItem(CLIENT_SESSION_KEY);
      toast.success("You left the batch. Your payment was forfeited.");
      resetClientFlow();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to leave batch";
      toast.error(message);
    }
  };

  const handleBackClick = () => {
    if (activeTab === "history") {
      setActiveTab("request");
      return;
    }

    if (resolvedStep === "batch") {
      setShowLeaveBatchWarning(true);
      return;
    }

    goBack();
  };

  const pageTitle =
    resolvedStep === "request"
      ? "Request Water"
      : resolvedStep === "payment"
        ? "Confirm Payment"
        : resolvedStep === "batch"
          ? "Your Batch"
          : resolvedStep === "tanker"
            ? requestMode === "priority"
              ? "Priority Delivery"
              : "Tanker Assigned"
            : resolvedStep === "delivery"
              ? "Delivery"
              : resolvedStep === "expired"
                ? "Batch Expired"
                : resolvedStep === "failed"
                  ? "Delivery Failed"
                  : resolvedStep === "partial"
                    ? "Delivery Resolved with Issues"
                    : "Completed";

  const handleDeliveryConfirmed = () => {
    toast.success("Delivery confirmed! Thank you.");
    setStep("completed");
  };

  useEffect(() => {
    if (!batchId) return;

    console.log("live batch state", {
      batchId,
      memberId,
      liveBatchLoading,
      liveBatch,
      liveBatchError,
      rawStep: step,
      resolvedStep,
    });
  }, [
    batchId,
    memberId,
    liveBatchLoading,
    liveBatch,
    liveBatchError,
    step,
    resolvedStep,
  ]);

  return {
    step: resolvedStep,
    rawStep: step,
    resolvedStep,
    setStep,

    selectedSize,
    setSelectedSize,

    requestMode,
    setRequestMode,

    priorityMode,
    setPriorityMode,

    scheduledFor,
    setScheduledFor,

    showHelp,
    setShowHelp,

    showLeaveBatchWarning,
    setShowLeaveBatchWarning,

    otp,
    price,
    canContinueToPayment,
    pageTitle,

    copyOtp,
    goBack,
    handleContinueToPayment,
    handlePayment,
    handleCancelBeforePayment,
    handleLeaveBatch,
    resetClientFlow,
    handleDeliveryConfirmed,
    handleBackClick,

    isSubmittingRequest,
    isRecoveringPriorityRequest,

    requestId,
    batchId,
    memberId,
    paymentDeadline,

    currentUser,
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,
    handleAuthSuccess,
    handleLogout,

    liveBatch,
    liveBatchLoading,
    liveBatchError,
    refreshLiveBatch,

    livePriorityRequest,
    livePriorityLoading,
    livePriorityError,
    refreshLivePriorityRequest,

    activeTab,
    setActiveTab,
  };
};
