import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientStep, RequestMode } from "@/types/client";
import {
  BATCH_FILL_TIMEOUT_MINUTES,
  LOADING_TIMEOUT_MINUTES,
  PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES,
  DELIVERY_TIMEOUT_HOURS,
} from "@/constants/timePolicy";

interface StepDef {
  label: string;
  timeLabel: string;
}

const BATCH_STEPS: StepDef[] = [
  { label: "Batch Forming",  timeLabel: `≤ ${BATCH_FILL_TIMEOUT_MINUTES} min` },
  { label: "Loading",        timeLabel: `≤ ${LOADING_TIMEOUT_MINUTES} min` },
  { label: "En Route",       timeLabel: `≤ ${DELIVERY_TIMEOUT_HOURS} h` },
  { label: "Arrived",        timeLabel: "" },
  { label: "Delivered",      timeLabel: "" },
];

const PRIORITY_STEPS: StepDef[] = [
  { label: "Finding Tanker", timeLabel: `≤ ${PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES} min` },
  { label: "Loading",        timeLabel: `≤ ${LOADING_TIMEOUT_MINUTES} min` },
  { label: "En Route",       timeLabel: `≤ ${DELIVERY_TIMEOUT_HOURS} h` },
  { label: "Arrived",        timeLabel: "" },
  { label: "Delivered",      timeLabel: "" },
];

function computeStepIndex(
  mode: RequestMode,
  liveData: LiveSnapshot | null | undefined,
  step: ClientStep,
): number {
  if (!liveData) {
    if (step === "batch") return 0;
    if (step === "tanker") return mode === "priority" ? 0 : 1;
    if (step === "delivery") return 2;
    if (step === "completed") return 4;
    return 0;
  }

  if (mode === "batch") {
    const batchStatus = liveData.status ?? "";
    const memberStatus = liveData.member_delivery_status ?? "";

    if (memberStatus === "delivered" || ["completed", "partially_completed"].includes(batchStatus))
      return 4;
    if (["arrived", "measuring", "awaiting_otp"].includes(memberStatus) || batchStatus === "arrived")
      return 3;
    if (memberStatus === "en_route" || batchStatus === "delivering")
      return 2;
    if (["assigned", "loading"].includes(batchStatus))
      return 1;
    return 0;
  }

  const reqStatus = liveData.request_status ?? "";
  const deliveryStatus = liveData.delivery_status ?? "";
  const tankerStatus = liveData.tanker_status ?? "";

  if (deliveryStatus === "delivered" || ["completed", "partially_completed"].includes(reqStatus))
    return 4;
  if (["arrived", "measuring", "awaiting_otp"].includes(deliveryStatus) || reqStatus === "arrived")
    return 3;
  if (deliveryStatus === "en_route" || reqStatus === "delivering")
    return 2;
  if (tankerStatus === "loading" || reqStatus === "loading")
    return 1;
  return 0;
}

// Minimal shape covering both BatchLiveResponse and PriorityLiveResponse
interface LiveSnapshot {
  status?: string | null;
  member_delivery_status?: string | null;
  request_status?: string | null;
  delivery_status?: string | null;
  tanker_status?: string | null;
}

interface DeliveryStepBarProps {
  step: ClientStep;
  requestMode: RequestMode;
  liveData: LiveSnapshot | null | undefined;
}

export default function DeliveryStepBar({ step, requestMode, liveData }: DeliveryStepBarProps) {
  const steps = requestMode === "priority" ? PRIORITY_STEPS : BATCH_STEPS;
  const currentIndex = computeStepIndex(requestMode, liveData, step);

  return (
    <div className="border-b border-border bg-card px-4 pb-3 pt-2.5">
      {/* Dots + connecting lines */}
      <div className="flex items-center">
        {steps.map((s, i) => {
          const isDone = i < currentIndex || (i === currentIndex && i === steps.length - 1);
          const isCurrent = i === currentIndex && i < steps.length - 1;
          const isLast = i === steps.length - 1;

          return (
            <div key={i} className="flex flex-1 items-center last:flex-none">
              <div
                className={cn(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                  isDone
                    ? "border-emerald-500 bg-emerald-500"
                    : isCurrent
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40 bg-transparent"
                )}
              >
                {isDone && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i < currentIndex ? "bg-emerald-500" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="mt-1.5 flex">
        {steps.map((s, i) => {
          const isDone = i < currentIndex || (i === currentIndex && i === steps.length - 1);
          const isCurrent = i === currentIndex && i < steps.length - 1;
          const isLast = i === steps.length - 1;

          return (
            <div
              key={i}
              className={cn(
                "flex flex-col",
                isLast ? "items-end" : i === 0 ? "flex-1 items-start" : "flex-1 items-center"
              )}
            >
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  isDone
                    ? "font-bold text-emerald-600 dark:text-emerald-400"
                    : isCurrent
                    ? "font-bold text-primary"
                    : "font-medium text-muted-foreground"
                )}
              >
                {s.label}
              </span>
              {s.timeLabel && (
                <span className="text-[9px] leading-tight text-muted-foreground">
                  {s.timeLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
