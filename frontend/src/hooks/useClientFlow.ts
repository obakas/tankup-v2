import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ClientStep, RequestMode } from "@/types/client";
import {
  BATCH_PRICE_PER_LITER,
  PRIORITY_FULL_TANKER_PRICE,
  PLATFORM_PRIORITY_COMMISSION_RATE,
  PLATFORM_BATCH_COMMISSION_RATE,
} from "@/constants/water";
import { useLiveBatch } from "@/hooks/useLiveBatch";
import {
  createWaterRequest,
  confirmPayment,
  listUserSites,
  type UserResponse,
  type SiteProfileResponse,
} from "@/lib/api";
import { leaveBatchMember, initiateBatchBoost, confirmBoostPayment } from "@/lib/batches";
import { useLivePriorityRequest } from "@/hooks/useLivePriorityRequest";
import { fetchScheduledRequestLive } from "@/lib/requests";
import { fetchActivePriorityRequest, cancelPriorityRequest, type CancelPriorityResponse } from "@/lib/requests";

interface UseClientFlowParams {
  onBack: () => void;
}


interface ClientSession {
  requestId: number | null;
  batchId: number | null;
  memberId: number | null;
  paymentDeadline: string | null;
  requestMode: RequestMode;
  selectedSize: number | null;
  selectedSiteId: number | null;
  priorityMode: "asap" | "scheduled";
  scheduledFor: string;
  otp: string;
  paymentIdempotencyKey: string | null;
}

interface RequestResponseWithOtp {
  request_id?: number | null;
  batch_id?: number | null;
  member_id?: number | null;
  payment_deadline?: string | null;
  delivery_code?: string | null;
  request_status?: string | null;
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
  const [step, setStep] = useState<ClientStep>("auth");
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [requestMode, setRequestMode] = useState<RequestMode>("batch");
  const [priorityMode, setPriorityMode] = useState<"asap" | "scheduled">("asap");
  const [scheduledFor, setScheduledFor] = useState<string>("");

  const [userSites, setUserSites] = useState<SiteProfileResponse[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);

  const [showHelp, setShowHelp] = useState(false);
  const [showLeaveBatchWarning, setShowLeaveBatchWarning] = useState(false);
  const [showCancelPriorityModal, setShowCancelPriorityModal] = useState(false);
  const [cancelPriorityStage, setCancelPriorityStage] = useState<CancelPriorityResponse["cancellation_stage"] | null>(null);
  const [cancelPriorityRefundPct, setCancelPriorityRefundPct] = useState<number | null>(null);
  const [isCancellingPriority, setIsCancellingPriority] = useState(false);
  const [otp, setOtp] = useState<string>("");

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isLeavingBatch, setIsLeavingBatch] = useState(false);
  const [isBoostLoading, setIsBoostLoading] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [paymentDeadline, setPaymentDeadline] = useState<string | null>(null);

  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
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

  // Poll scheduled request until it activates
  const scheduledPollRef = useRef<number | null>(null);
  useEffect(() => {
    if (step !== "scheduled" || !requestId) {
      if (scheduledPollRef.current) window.clearInterval(scheduledPollRef.current);
      return;
    }

    const poll = async () => {
      const data = await fetchScheduledRequestLive(requestId).catch(() => null);
      if (!data || data.request_status === "scheduled") return;

      if (scheduledPollRef.current) window.clearInterval(scheduledPollRef.current);
      if (data.batch_id && data.member_id) {
        setBatchId(data.batch_id);
        setMemberId(data.member_id);
        setStep("batch");
      } else {
        setStep("tanker");
      }
    };

    void poll();
    scheduledPollRef.current = window.setInterval(poll, 30000);
    return () => { if (scheduledPollRef.current) window.clearInterval(scheduledPollRef.current); };
  }, [step, requestId]);

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
      requestStatus === "cancelled" ||
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
      tankerStatus === "queued" ||
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

    if (["assigned", "queued", "loading"].includes(status)) {
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
    // Pre-payment steps are not affected by live batch/priority state — stale
    // data from a previous session must not override these early steps.
    if (step === "auth" || step === "request" || step === "payment") {
      return step;
    }

    if (requestMode === "batch") {
      // Discard liveBatch data synchronously if it belongs to a different batch
      // (e.g. stale data from a previous session before the useLiveBatch effect
      // has had a chance to clear it).
      const freshBatch = liveBatch?.batch_id === batchId ? liveBatch : null;
      return resolveClientStep(freshBatch, step);
    }

    return resolvePriorityClientStep(livePriorityRequest, step);
  }, [requestMode, batchId, liveBatch, livePriorityRequest, step]);

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
    if (currentUser && !selectedSiteId) return false;
    if (requestMode === "batch") return true;
    if (priorityMode === "asap") return true;
    return !!scheduledFor;
  }, [selectedSize, selectedSiteId, currentUser, requestMode, priorityMode, scheduledFor]);

  useEffect(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    if (!savedUser) return;

    try {
      const parsedUser: UserResponse = JSON.parse(savedUser);
      setCurrentUser(parsedUser);
      setStep("request");
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
      setSelectedSiteId(parsed.selectedSiteId ?? null);
      setPriorityMode(parsed.priorityMode ?? "asap");
      setScheduledFor(parsed.scheduledFor ?? "");
      setOtp(parsed.otp ?? "");
      setPaymentIdempotencyKey(parsed.paymentIdempotencyKey ?? null);

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
      selectedSiteId,
      priorityMode,
      scheduledFor,
      otp,
      paymentIdempotencyKey,
    };

    const hasSessionData =
      !!requestId ||
      !!batchId ||
      !!memberId ||
      !!paymentDeadline ||
      !!selectedSize ||
      !!paymentIdempotencyKey ||
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
    selectedSiteId,
    priorityMode,
    scheduledFor,
    otp,
    paymentIdempotencyKey,
  ]);

  const refreshUserSites = useCallback(async (userId: number) => {
    setLoadingSites(true);
    try {
      const sites = await listUserSites(userId);
      setUserSites(sites);
    } catch {
      // silently fail — user can retry via SitesDialog
    } finally {
      setLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      void refreshUserSites(currentUser.id);
    } else {
      setUserSites([]);
      setSelectedSiteId(null);
    }
  }, [currentUser, refreshUserSites]);

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
        selectedSiteId: null,
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
      setStep("auth");
      return;
    }

    // Generate once per payment attempt; survives page reload via session so
    // retries re-use the same key and the backend returns the cached response.
    if (!paymentIdempotencyKey) {
      setPaymentIdempotencyKey(crypto.randomUUID());
    }

    setStep("payment");
  };

  const handleAuthSuccess = (user: UserResponse) => {
    setCurrentUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setStep("request");
    toast.success(`Welcome, ${user.name}! Please select a delivery site to continue.`);
    void recoverActivePriorityRequest(user);
  };

  const resetClientFlow = () => {
    localStorage.removeItem(CLIENT_SESSION_KEY);
    setStep("request");
    setSelectedSize(null);
    setSelectedSiteId(null);
    setRequestMode("batch");
    setPriorityMode("asap");
    setScheduledFor("");
    setShowHelp(false);
    setShowLeaveBatchWarning(false);
    setShowCancelPriorityModal(false);
    setCancelPriorityStage(null);
    setCancelPriorityRefundPct(null);
    setIsCancellingPriority(false);
    setOtp("");
    setIsSubmittingRequest(false);
    setRequestId(null);
    setBatchId(null);
    setMemberId(null);
    setPaymentDeadline(null);
    setPaymentIdempotencyKey(null);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(USER_KEY);
    toast.success("Logged out");
    resetClientFlow();
    setStep("auth");
  };

  const goBack = () => {
    if (resolvedStep === "auth" || resolvedStep === "request") {
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
    if (isSubmittingRequest) return;

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
      setStep("auth");
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
        site_profile_id: selectedSiteId ?? undefined,
        idempotency_key: paymentIdempotencyKey ?? undefined,
        ...(requestMode === "priority"
          ? priorityMode === "asap"
            ? { is_asap: true }
            : { is_asap: false, scheduled_for: scheduledFor }
          : requestMode === "batch" && scheduledFor
          ? { scheduled_for: scheduledFor }
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
        // Scheduled batch — no member yet; batch formation is deferred
        if (response.request_status === "scheduled") {
          setRequestId(nextRequestId);
          const clientSession: ClientSession = {
            requestId: nextRequestId,
            batchId: null,
            memberId: null,
            paymentDeadline: null,
            requestMode,
            selectedSize,
            selectedSiteId,
            priorityMode,
            scheduledFor,
            otp: "",
          };
          localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(clientSession));
          toast.success("Scheduled! We'll start searching when your window opens.");
          setStep("scheduled");
          return;
        }

        if (!nextMemberId) {
          throw new Error("Batch member ID missing from create request response");
        }

        // Simulate successful payment after request creation.
        // Backend will then promote batch / refresh state / trigger assignment.
        const paymentConfirmResponse =
          (await confirmPayment(nextMemberId)) as RequestResponseWithOtp;

        const confirmedRequestId =
          paymentConfirmResponse.request_id ?? nextRequestId;
        const confirmedBatchId =
          paymentConfirmResponse.batch_id ?? nextBatchId;
        const confirmedMemberId =
          paymentConfirmResponse.member_id ?? nextMemberId;
        const confirmedPaymentDeadline =
          paymentConfirmResponse.payment_deadline ?? nextPaymentDeadline;
        const confirmedOtp =
          paymentConfirmResponse.delivery_code ?? nextOtp;

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
          selectedSiteId,
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
        selectedSiteId,
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
    setSelectedSiteId(null);
    setPriorityMode("asap");
    setScheduledFor("");
    setRequestMode("batch");
    setOtp("");
    setPaymentIdempotencyKey(null);
    toast.success("Request cancelled before payment");
    setStep("request");
  };

  const handleBoost = async (additionalVolume: number) => {
    if (!memberId) return;
    setIsBoostLoading(true);
    try {
      const { payment_id } = await initiateBatchBoost(memberId, additionalVolume);
      await confirmBoostPayment(payment_id);
      toast.success(`Boosted by ${additionalVolume.toLocaleString()}L!`);
      refreshLiveBatch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Boost failed";
      toast.error(message);
    } finally {
      setIsBoostLoading(false);
    }
  };

  const handleLeaveBatch = async () => {
    if (isLeavingBatch) return;
    if (!memberId) {
      toast.error("No batch membership found");
      return;
    }

    try {
      setIsLeavingBatch(true);
      await leaveBatchMember(memberId);
      localStorage.removeItem(CLIENT_SESSION_KEY);
      toast.success("You left the batch. Your payment was forfeited.");
      resetClientFlow();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to leave batch";
      toast.error(message);
    } finally {
      setIsLeavingBatch(false);
    }
  };

  const handleOpenCancelPriorityModal = () => {
    const dr = livePriorityRequest;
    const reqStatus = dr?.request_status ?? "";
    const drStatus = dr?.delivery_status ?? null;

    if (drStatus === "awaiting_otp" || drStatus === "delivered") {
      toast.error("Cancellation is not allowed — water has already been fully pumped.");
      return;
    }

    let stage: CancelPriorityResponse["cancellation_stage"] = "en_route";
    let refundPct = 0;

    if ((reqStatus === "assigned" || reqStatus === "queued") && (!drStatus || drStatus === "pending")) {
      stage = "pre_loading";
      refundPct = 0.5;
    } else if (drStatus === "measuring") {
      const start = dr?.meter_start_reading ?? null;
      const end = dr?.meter_end_reading ?? null;
      const planned = dr?.planned_liters ?? null;
      if (start != null && end != null && planned && planned > 0) {
        const actual = end - start;
        refundPct = Math.max(0, 1 - actual / planned);
        stage = "partial_delivery";
      } else {
        stage = "arrived";
      }
    } else if (drStatus === "arrived") {
      stage = "arrived";
    }

    setCancelPriorityStage(stage);
    setCancelPriorityRefundPct(refundPct);
    setShowCancelPriorityModal(true);
  };

  const handleConfirmCancelPriority = async () => {
    if (!requestId) return;
    setIsCancellingPriority(true);
    try {
      await cancelPriorityRequest(requestId);
      localStorage.removeItem(CLIENT_SESSION_KEY);
      toast.success("Priority delivery cancelled.");
      resetClientFlow();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel delivery";
      toast.error(message);
    } finally {
      setIsCancellingPriority(false);
      setShowCancelPriorityModal(false);
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
    resolvedStep === "auth"
      ? "Get Started"
      : resolvedStep === "request"
        ? "Request Water"
      : resolvedStep === "payment"
        ? "Confirm Payment"
        : resolvedStep === "batch"
          ? "Your Batch"
          : resolvedStep === "tanker"
            ? requestMode === "priority"
              ? "Exclusive Delivery"
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

    selectedSiteId,
    setSelectedSiteId,

    userSites,
    loadingSites,
    refreshUserSites,

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

    showCancelPriorityModal,
    setShowCancelPriorityModal,
    cancelPriorityStage,
    cancelPriorityRefundPct,
    isCancellingPriority,
    handleOpenCancelPriorityModal,
    handleConfirmCancelPriority,

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
    handleBoost,
    isBoostLoading,
    resetClientFlow,
    handleDeliveryConfirmed,
    handleBackClick,

    isSubmittingRequest,
    isLeavingBatch,
    isRecoveringPriorityRequest,

    requestId,
    batchId,
    memberId,
    paymentDeadline,

    currentUser,
    setCurrentUser,
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
