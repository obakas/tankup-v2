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
  key: ClientStep;
  label: string;
  timeLabel: string;
}

const BATCH_STEPS: StepDef[] = [
  { key: "batch",     label: "Batch Forming",  timeLabel: `≤ ${BATCH_FILL_TIMEOUT_MINUTES} min` },
  { key: "tanker",    label: "Tanker Loading",  timeLabel: `≤ ${LOADING_TIMEOUT_MINUTES} min` },
  { key: "delivery",  label: "En Route",        timeLabel: `≤ ${DELIVERY_TIMEOUT_HOURS} h` },
  { key: "completed", label: "Delivered",       timeLabel: "" },
];

const PRIORITY_STEPS: StepDef[] = [
  { key: "tanker",    label: "Finding Tanker",  timeLabel: `≤ ${PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES} min` },
  { key: "delivery",  label: "En Route",        timeLabel: `≤ ${DELIVERY_TIMEOUT_HOURS} h` },
  { key: "completed", label: "Delivered",       timeLabel: "" },
];

interface DeliveryStepBarProps {
  step: ClientStep;
  requestMode: RequestMode;
}

export default function DeliveryStepBar({ step, requestMode }: DeliveryStepBarProps) {
  const steps = requestMode === "priority" ? PRIORITY_STEPS : BATCH_STEPS;
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="border-b border-border bg-card px-4 pb-3 pt-2.5">
      {/* Dots + connecting lines */}
      <div className="flex items-center">
        {steps.map((s, i) => {
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isLast = i === steps.length - 1;

          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              {/* Dot */}
              <div
                className={cn(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                  isPast
                    ? "border-emerald-500 bg-emerald-500"
                    : isCurrent
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40 bg-transparent"
                )}
              >
                {isPast && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    isPast ? "bg-emerald-500" : "bg-border"
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
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isLast = i === steps.length - 1;

          return (
            <div
              key={s.key}
              className={cn(
                "flex flex-col",
                isLast ? "items-end" : i === 0 ? "items-start flex-1" : "flex-1 items-center"
              )}
            >
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  isPast
                    ? "font-medium text-emerald-600 dark:text-emerald-400"
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
