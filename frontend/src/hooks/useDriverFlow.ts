import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { DriverUser } from "@/hooks/useDriverAuth";
import type { DriverJob, DriverStep, DriverStop } from "@/types/driver";
import {
  fetchCurrentDriverJob,
  fetchCurrentStop,
  fetchIncomingOffer,
  acceptIncomingOffer,
  rejectIncomingOffer,
  // acceptDriverBatch,
  // acceptDriverPriority,
  startDriverBatchLoading,
  startDriverPriorityLoading,
  markDriverBatchLoaded,
  markDriverPriorityLoaded,
  arriveAtStop,
  startStopMeasurement,
  finishStopMeasurement,
  confirmStopOtp,
  completeStop,
  failStop,
  skipStop,
  type DriverCurrentJobResponse,
  type DriverCurrentStopResponse,
  type IncomingDriverOffer,
  type TankerLocationResponse,
  getDriverLocation,
} from "@/lib/driverApi";
import { useDriverLocationHeartbeat } from "./useDriverLocationHeartbeat";

function mapJobResponseToDriverJob(
  response: DriverCurrentJobResponse | null
): DriverJob | null {
  if (!response?.active_job || !response.assignment_type) {
    return null;
  }

  const activeJob = response.active_job;

  if (response.assignment_type === "batch") {
    const stops: DriverStop[] = (activeJob.members ?? []).map((member) => ({
      id: member.request_id ?? member.id,
      name: member.name ?? "Customer",
      address: member.address ?? "No address provided",
      phone: member.phone ?? undefined,
      volumeLiters: member.volume_liters,
      otp: member.delivery_code ?? undefined,
      delivered: member.status === "delivered",
      latitude: member.latitude ?? undefined,
      longitude: member.longitude ?? undefined,
    }));

    return {
      jobId: activeJob.batch_id ?? 0,
      jobType: "batch",
      // status:
      //   response.tanker_status === "available"
      //     ? "assigned"
      //     : (response.tanker_status as DriverJob["status"]),
      status: response.tanker_status as DriverJob["status"],
      liquidName: undefined,
      totalVolumeLiters:
        activeJob.total_volume ??
        stops.reduce((sum, stop) => sum + stop.volumeLiters, 0),
      stops,
    };
  }

  const customer = activeJob.customer;
  const priorityStop: DriverStop = {
    id: activeJob.request_id ?? 0,
    name: customer?.name ?? "Priority Customer",
    address: customer?.address ?? "No address provided",
    phone: customer?.phone ?? undefined,
    volumeLiters: customer?.volume_liters ?? 0,
    otp: customer?.delivery_code ?? undefined,
    delivered: false,
    latitude: customer?.latitude ?? undefined,
    longitude: customer?.longitude ?? undefined,
  };

  return {
    jobId: activeJob.request_id ?? 0,
    jobType: "priority",
    // status:
    //   response.tanker_status === "available"
    //     ? "assigned"
    //     : (response.tanker_status as DriverJob["status"]),
    status: response.tanker_status as DriverJob["status"],
    liquidName: undefined,
    totalVolumeLiters: customer?.volume_liters ?? activeJob.total_volume ?? 0,
    stops: [priorityStop],
  };
}

function mergeStopsWithCurrentStop(
  baseJob: DriverJob | null,
  stopResponse: DriverCurrentStopResponse | null
): DriverStop[] {
  if (!baseJob) return [];

  const baseStops = baseJob.stops ?? [];
  const currentStop = stopResponse?.current_stop;

  if (!currentStop) {
    return baseStops;
  }

  return baseStops.map((stop, index) => {
    const matchesCurrent =
      index + 1 === currentStop.stop_order ||
      (!!stop.phone &&
        !!currentStop.customer.phone &&
        stop.phone === currentStop.customer.phone);

    if (!matchesCurrent) {
      return stop;
    }

    return {
      ...stop,
      name: currentStop.customer.name ?? stop.name,
      address: currentStop.customer.address ?? stop.address,
      phone: currentStop.customer.phone ?? stop.phone,
      volumeLiters: currentStop.planned_liters ?? stop.volumeLiters,
      otp: currentStop.delivery_code ?? stop.otp,
      delivered: currentStop.delivery_status === "delivered",
      latitude: currentStop.location.latitude ?? stop.latitude,
      longitude: currentStop.location.longitude ?? stop.longitude,
    };
  });
}

function getStepFromState(
  driver: DriverUser | null,
  jobResponse: DriverCurrentJobResponse | null,
  stopResponse: DriverCurrentStopResponse | null,
  hadActiveStop: boolean,
  incomingOffer: IncomingDriverOffer | null
): DriverStep {
  if (!driver) return "offline";

  if (incomingOffer) {
    return "assigned";
  }

  const tankerStatus =
    stopResponse?.tanker?.status ?? jobResponse?.tanker_status ?? null;

  if (!jobResponse?.active_job && !stopResponse?.current_stop) {
    return hadActiveStop ? "completed" : "available";
  }

  if (stopResponse?.current_stop) {
    return "delivering";
  }

  switch (tankerStatus) {
    case "assigned":
      return "assigned";
    case "loading":
      return "loading";
    case "delivering":
    case "arrived":
      return "delivering";
    case "completed":
      return "completed";
    default:
      return "available";
  }
}

export const useDriverFlow = (driver: DriverUser | null) => {
  const [jobResponse, setJobResponse] = useState<DriverCurrentJobResponse | null>(null);
  const [stopResponse, setStopResponse] = useState<DriverCurrentStopResponse | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<IncomingDriverOffer | null>(null);
  const [driverLocation, setDriverLocation] = useState<TankerLocationResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"dashboard" | "history">("dashboard");

  const [otpInput, setOtpInput] = useState("");
  const [meterStartReading, setMeterStartReading] = useState("");
  const [meterEndReading, setMeterEndReading] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [skipReason, setSkipReason] = useState("");

  const [hadActiveStop, setHadActiveStop] = useState(false);

  const tankerId = driver?.tankerId ?? null;

  const refreshJob = useCallback(async () => {
    if (!tankerId) {
      setJobResponse(null);
      setStopResponse(null);
      setIncomingOffer(null);
      setDriverLocation(null);
      return;
    }

    setIsLoading(true);

    const [offerResult, jobResult, stopResult, locationResult] = await Promise.allSettled([
      fetchIncomingOffer(tankerId),
      fetchCurrentDriverJob(tankerId),
      fetchCurrentStop(tankerId),
      getDriverLocation(tankerId),
    ]);

    const offer =
      offerResult.status === "fulfilled" && offerResult.value?.has_offer
        ? offerResult.value.offer
        : null;

    // const job = jobResult.status === "fulfilled" ? jobResult.value : null;
    if (jobResult.status === "rejected") {
      console.error("fetchCurrentDriverJob failed:", jobResult.reason);
    }

    const job =
      jobResult.status === "fulfilled" ? jobResult.value : null;
    const stop = stopResult.status === "fulfilled" ? stopResult.value : null;

    const location = locationResult.status === "fulfilled" ? locationResult.value : null;

    setIncomingOffer(offer);
    setJobResponse(job);
    setStopResponse(stop);
    setDriverLocation(location);

    if (stop?.current_stop) {
      setHadActiveStop(true);
    }

    setIsLoading(false);
  }, [tankerId]);

  useEffect(() => {
    if (!tankerId) return;

    void refreshJob();

    const interval = window.setInterval(() => {
      void refreshJob();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [tankerId, refreshJob]);

  const activeJob = useMemo(
    () => mapJobResponseToDriverJob(jobResponse),
    [jobResponse]
  );

  const deliveries = useMemo(
    () => mergeStopsWithCurrentStop(activeJob, stopResponse),
    [activeJob, stopResponse]
  );

  const currentStop = stopResponse?.current_stop ?? null;
  const allowedActions = stopResponse?.allowed_actions ?? [];

  const activeDeliveryIdx = useMemo(() => {
    if (!deliveries.length) return -1;

    if (currentStop?.stop_order && currentStop.stop_order > 0) {
      return currentStop.stop_order - 1;
    }

    return deliveries.findIndex((stop) => !stop.delivered);
  }, [deliveries, currentStop]);

  const currentDelivery = useMemo(() => {
    if (activeDeliveryIdx < 0) return null;
    return deliveries[activeDeliveryIdx] ?? null;
  }, [deliveries, activeDeliveryIdx]);

  const deliveredCount = useMemo(() => {
    const fromStopSummary =
      stopResponse?.stops_summary?.filter(
        (stop) => stop.delivery_status === "delivered"
      ).length ?? 0;

    if (stopResponse?.stops_summary?.length) {
      return fromStopSummary;
    }

    return deliveries.filter((stop) => stop.delivered).length;
  }, [deliveries, stopResponse]);

  const allDelivered = useMemo(() => {
    if (stopResponse?.job) {
      return stopResponse.job.remaining_stops === 0;
    }

    return deliveries.length > 0 && deliveredCount === deliveries.length;
  }, [stopResponse, deliveries, deliveredCount]);

  // const step: DriverStep = useMemo(() => {
  //   return getStepFromState(driver, jobResponse, stopResponse, hadActiveStop);
  // }, [driver, jobResponse, stopResponse, hadActiveStop]);

  const step: DriverStep = useMemo(() => {
    return getStepFromState(
      driver,
      jobResponse,
      stopResponse,
      hadActiveStop,
      incomingOffer
    );
  }, [driver, jobResponse, stopResponse, hadActiveStop, incomingOffer]);

  const shouldSendLocation = useMemo(() => {
    if (!tankerId || !driver) return false;

    const tankerStatus =
      stopResponse?.tanker?.status ??
      jobResponse?.tanker_status ??
      "available";

    return tankerStatus !== "offline";
    // return ["assigned", "loading", "delivering", "arrived"].includes(tankerStatus);
  }, [tankerId, driver, stopResponse, jobResponse]);

  const nextInstruction = useMemo(() => {
    if (!driver) return "Log in to continue.";

    if (incomingOffer) {
      return "You have a new delivery offer. Accept or reject it.";
    }

    const tankerStatus =
      stopResponse?.tanker?.status ?? jobResponse?.tanker_status ?? null;

    if (!jobResponse?.active_job && !currentStop) {
      return "You are available. Waiting for the next delivery offer.";
    }

    if (currentStop) {
      if (allowedActions.includes("arrive")) {
        return "Drive to the customer and mark arrival.";
      }
      if (allowedActions.includes("start_measurement")) {
        return "Start water measurement for this stop.";
      }
      if (allowedActions.includes("finish_measurement")) {
        return "Finish measurement and prepare for OTP.";
      }
      if (allowedActions.includes("confirm_otp")) {
        return "Collect and verify the customer's OTP.";
      }
      if (allowedActions.includes("complete")) {
        return "Complete this delivery stop.";
      }
      if (allowedActions.includes("fail")) {
        return "If the stop cannot be completed, fail it with a reason.";
      }
    }

    if (tankerStatus === "assigned") {
      return "Start loading water now.";
    }

    if (tankerStatus === "loading") {
      return "Finish loading and mark the tanker as loaded.";
    }

    if (tankerStatus === "delivering" || tankerStatus === "arrived") {
      return "Continue the active stop.";
    }

    return "Refresh to sync the latest driver state.";
  }, [driver, incomingOffer, stopResponse, jobResponse, currentStop, allowedActions]);

  useDriverLocationHeartbeat({
    tankerId,
    enabled: shouldSendLocation,
    intervalMs: 8000,
  });

  const resetInputs = useCallback(() => {
    setOtpInput("");
    setMeterStartReading("");
    setMeterEndReading("");
    setDeliveryNotes("");
    setFailureReason("");
    setSkipReason("");
  }, []);

  const runAction = useCallback(
    async (
      action: () => Promise<void>,
      successMessage: string,
      options?: { clearInputs?: boolean }
    ) => {
      try {
        setIsActionLoading(true);
        await action();
        toast.success(successMessage);

        if (options?.clearInputs) {
          resetInputs();
        }

        await refreshJob();
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : "Action failed. Please try again.";
        toast.error(message);
      } finally {
        setIsActionLoading(false);
      }
    },
    [refreshJob, resetInputs]
  );

  const acceptOffer = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!incomingOffer) {
      toast.error("No incoming offer found.");
      return;
    }

    await runAction(
      async () => {
        await acceptIncomingOffer(tankerId, incomingOffer);
      },
      "Offer accepted successfully."
    );
  }, [tankerId, incomingOffer, runAction]);

  const rejectOffer = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!incomingOffer) {
      toast.error("No incoming offer found.");
      return;
    }

    await runAction(
      async () => {
        await rejectIncomingOffer(tankerId);
      },
      "Offer rejected successfully."
    );
  }, [tankerId, incomingOffer, runAction]);

  const startLoading = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!jobResponse?.active_job || !jobResponse.assignment_type) {
      toast.error("No active assigned job found.");
      return;
    }

    if (jobResponse.tanker_status !== "assigned") {
      toast.error("This job is not ready for loading yet.");
      return;
    }

    if (jobResponse.assignment_type === "batch") {
      const batchId = jobResponse.active_job.batch_id;
      if (!batchId) {
        toast.error("Batch ID is missing.");
        return;
      }

      await runAction(
        async () => {
          await startDriverBatchLoading(tankerId, batchId);
        },
        "Loading started. Fill the tanker before delivery."
      );

      return;
    }

    const requestId = jobResponse.active_job.request_id;
    if (!requestId) {
      toast.error("Priority request ID is missing.");
      return;
    }

    await runAction(
      async () => {
        await startDriverPriorityLoading(tankerId, requestId);
      },
      "Loading started. Fill the tanker before delivery."
    );
  }, [tankerId, jobResponse, runAction]);

  const markLoaded = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!jobResponse?.active_job || !jobResponse.assignment_type) {
      toast.error("No active job found.");
      return;
    }

    if (jobResponse.tanker_status !== "loading") {
      toast.error("You must start loading before you can mark water as loaded.");
      return;
    }

    if (jobResponse.assignment_type === "batch") {
      const batchId = jobResponse.active_job.batch_id;
      if (!batchId) {
        toast.error("Batch ID is missing.");
        return;
      }

      await runAction(
        async () => {
          await markDriverBatchLoaded(tankerId, batchId);
        },
        "Water loaded. Head to the customer now."
      );

      return;
    }

    const requestId = jobResponse.active_job.request_id;
    if (!requestId) {
      toast.error("Priority request ID is missing.");
      return;
    }

    await runAction(
      async () => {
        await markDriverPriorityLoaded(tankerId, requestId);
      },
      "Water loaded. Head to the customer now."
    );
  }, [tankerId, jobResponse, runAction]);

  const markArrived = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!currentStop) {
      toast.error("No active stop found.");
      return;
    }

    if (!allowedActions.includes("arrive")) {
      toast.error("This stop cannot be marked as arrived right now.");
      return;
    }

    await runAction(
      async () => {
        await arriveAtStop(tankerId, currentStop.delivery_id);
      },
      "Driver marked as arrived."
    );
  }, [tankerId, currentStop, allowedActions, runAction]);

  const beginMeasurement = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!currentStop) {
      toast.error("No active stop found.");
      return;
    }

    if (!allowedActions.includes("start_measurement")) {
      toast.error("Measurement cannot be started right now.");
      return;
    }

    const startValue = Number(meterStartReading);
    if (!Number.isFinite(startValue) || startValue < 0) {
      toast.error("Enter a valid meter start reading.");
      return;
    }

    await runAction(
      async () => {
        await startStopMeasurement(tankerId, currentStop.delivery_id, startValue);
      },
      "Measurement started successfully."
    );
  }, [tankerId, currentStop, allowedActions, meterStartReading, runAction]);

  const finishMeasurement = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!currentStop) {
      toast.error("No active stop found.");
      return;
    }

    if (!allowedActions.includes("finish_measurement")) {
      toast.error("Measurement cannot be finished right now.");
      return;
    }

    const endValue = Number(meterEndReading);
    if (!Number.isFinite(endValue) || endValue < 0) {
      toast.error("Enter a valid meter end reading.");
      return;
    }

    await runAction(
      async () => {
        await finishStopMeasurement(
          tankerId,
          currentStop.delivery_id,
          endValue,
          deliveryNotes
        );
      },
      "Measurement completed successfully."
    );
  }, [
    tankerId,
    currentStop,
    allowedActions,
    meterEndReading,
    deliveryNotes,
    runAction,
  ]);

  const verifyOtp = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!currentStop) {
      toast.error("No active stop found.");
      return;
    }

    if (!allowedActions.includes("confirm_otp")) {
      toast.error("OTP cannot be confirmed right now.");
      return;
    }

    if (!otpInput.trim()) {
      toast.error("OTP is required.");
      return;
    }

    await runAction(
      async () => {
        await confirmStopOtp(tankerId, currentStop.delivery_id, otpInput.trim());
      },
      "OTP verified successfully.",
      { clearInputs: true }
    );
  }, [tankerId, currentStop, allowedActions, otpInput, runAction]);

  const completeDelivery = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!currentStop) {
      toast.error("No active stop found.");
      return;
    }

    if (!allowedActions.includes("complete")) {
      toast.error("This stop cannot be completed yet.");
      return;
    }

    await runAction(
      async () => {
        await completeStop(tankerId, currentStop.delivery_id);
      },
      "Stop completed successfully.",
      { clearInputs: true }
    );
  }, [tankerId, currentStop, allowedActions, runAction]);

  const failCurrentStop = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!currentStop) {
      toast.error("No active stop found.");
      return;
    }

    if (!failureReason.trim()) {
      toast.error("Please provide a failure reason.");
      return;
    }

    await runAction(
      async () => {
        await failStop(tankerId, currentStop.delivery_id, failureReason.trim());
      },
      "Stop marked as failed.",
      { clearInputs: true }
    );
  }, [tankerId, currentStop, failureReason, runAction]);

  const skipCurrentStop = useCallback(async () => {
    if (!tankerId) {
      toast.error("Please log in as a driver first.");
      return;
    }

    if (!currentStop) {
      toast.error("No active stop found.");
      return;
    }

    if (!skipReason.trim()) {
      toast.error("Please provide a skip reason.");
      return;
    }

    await runAction(
      async () => {
        await skipStop(tankerId, currentStop.delivery_id, skipReason.trim());
      },
      "Stop skipped.",
      { clearInputs: true }
    );
  }, [tankerId, currentStop, skipReason, runAction]);

  const resetToDashboard = useCallback(() => {
    setJobResponse(null);
    setStopResponse(null);
    setIncomingOffer(null);
    setHadActiveStop(false);
    resetInputs();
  }, [resetInputs]);

  return {
    step,

    incomingOffer,
    acceptOffer,
    rejectOffer,

    activeJob,
    deliveries,
    currentDelivery,
    activeDeliveryIdx,
    deliveredCount,
    allDelivered,

    jobResponse,
    stopResponse,
    currentStop,
    allowedActions,
    shouldSendLocation,

    otpInput,
    setOtpInput,

    meterStartReading,
    setMeterStartReading,
    meterEndReading,
    setMeterEndReading,
    deliveryNotes,
    setDeliveryNotes,
    failureReason,
    setFailureReason,
    skipReason,
    setSkipReason,

    isLoading,
    isActionLoading,

    refreshJob,
    // acceptJob,
    markLoaded,

    markArrived,
    beginMeasurement,
    finishMeasurement,
    verifyOtp,
    completeDelivery,
    failCurrentStop,
    skipCurrentStop,

    resetToDashboard,

    activeTab,
    setActiveTab,

    nextInstruction,
    startLoading,
    driverLocation,
  };
};