import { Fragment } from "react";
import { View, Text } from "react-native";
import type { TankupTheme } from "@/components/ui/theme";
import {
  BATCH_FILL_TIMEOUT_MINUTES,
  LOADING_TIMEOUT_MINUTES,
  PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES,
  DELIVERY_TIMEOUT_HOURS,
} from "@/constants/timePolicy";

const DOT_SIZE = 18;
const LABEL_WIDTH = 64;

interface StepDef {
  label: string;
  timeLabel: string;
}

const BATCH_STEPS: StepDef[] = [
  { label: "Batch Forming",  timeLabel: `≤ ${BATCH_FILL_TIMEOUT_MINUTES} min` },
  { label: "Queued",         timeLabel: "" },
  { label: "Loading",        timeLabel: `≤ ${LOADING_TIMEOUT_MINUTES} min` },
  { label: "En Route",       timeLabel: `≤ ${DELIVERY_TIMEOUT_HOURS} h` },
  { label: "Arrived",        timeLabel: "" },
  { label: "Delivered",      timeLabel: "" },
];

const PRIORITY_STEPS: StepDef[] = [
  { label: "Finding Tanker", timeLabel: `≤ ${PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES} min` },
  { label: "Queued",         timeLabel: "" },
  { label: "Loading",        timeLabel: `≤ ${LOADING_TIMEOUT_MINUTES} min` },
  { label: "En Route",       timeLabel: `≤ ${DELIVERY_TIMEOUT_HOURS} h` },
  { label: "Arrived",        timeLabel: "" },
  { label: "Delivered",      timeLabel: "" },
];

function computeStepIndex(
  mode: "batch" | "priority",
  liveData: any,
  fallbackStep: string,
): number {
  if (!liveData) {
    if (fallbackStep === "batch" || fallbackStep === "searching") return 0;
    if (fallbackStep === "tanker") return 1;
    if (fallbackStep === "delivery") return 3;
    if (fallbackStep === "completed") return 5;
    return 0;
  }

  if (mode === "batch") {
    const batchStatus: string = liveData.status ?? "";
    const memberStatus: string = liveData.member_delivery_status ?? "";

    if (memberStatus === "delivered" || ["completed", "partially_completed"].includes(batchStatus))
      return 5;
    if (["arrived", "measuring", "awaiting_otp"].includes(memberStatus) || batchStatus === "arrived")
      return 4;
    if (memberStatus === "en_route" || batchStatus === "delivering")
      return 3;
    if (batchStatus === "loading")
      return 2;
    if (batchStatus === "queued")
      return 1;
    return 0;
  }

  const reqStatus: string = liveData.request_status ?? "";
  const deliveryStatus: string = liveData.delivery_status ?? "";
  const tankerStatus: string = liveData.tanker_status ?? "";

  if (deliveryStatus === "delivered" || ["completed", "partially_completed"].includes(reqStatus))
    return 5;
  if (["arrived", "measuring", "awaiting_otp"].includes(deliveryStatus) || reqStatus === "arrived")
    return 4;
  if (deliveryStatus === "en_route" || reqStatus === "delivering")
    return 3;
  if (tankerStatus === "loading" || reqStatus === "loading")
    return 2;
  if (tankerStatus === "queued" || reqStatus === "queued")
    return 1;
  return 0;
}

interface DeliveryStepBarProps {
  currentStep: string;
  mode: "batch" | "priority";
  liveData: any;
  theme: TankupTheme;
}

export function DeliveryStepBar({ currentStep, mode, liveData, theme }: DeliveryStepBarProps) {
  const steps = mode === "priority" ? PRIORITY_STEPS : BATCH_STEPS;
  const currentIndex = computeStepIndex(mode, liveData, currentStep);

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        {steps.map((step, i) => {
          const isFirst = i === 0;
          const isLast = i === steps.length - 1;
          const isDone = i < currentIndex || (i === currentIndex && isLast);
          const isCurrent = i === currentIndex && !isLast;
          const dotColor = isDone ? theme.success : isCurrent ? theme.primary : theme.border;
          // Line before step i is green when step i-1 is done (i.e. i <= currentIndex)
          const lineBgColor = i <= currentIndex ? theme.success : theme.border;
          const labelColor = isDone ? theme.success : isCurrent ? theme.primary : theme.mutedForeground;
          // Negative margin centers the wider label under the narrow dot
          const labelMarginLeft = isFirst
            ? 0
            : isLast
            ? -(LABEL_WIDTH - DOT_SIZE)
            : -(LABEL_WIDTH - DOT_SIZE) / 2;
          const labelAlign: "left" | "center" | "right" = isFirst ? "left" : isLast ? "right" : "center";

          return (
            <Fragment key={i}>
              {/* Connecting line — placed BEFORE each step except the first */}
              {!isFirst && (
                <View
                  style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: lineBgColor,
                    // Vertically centers the line at the dot's midpoint
                    marginTop: DOT_SIZE / 2 - 1,
                    alignSelf: "flex-start",
                  }}
                />
              )}

              {/* Step column: dot above, label below — both anchored at the 18px dot */}
              <View style={{ width: DOT_SIZE, alignItems: "center" }}>
                {/* Dot */}
                <View
                  style={{
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: DOT_SIZE / 2,
                    backgroundColor: isDone || isCurrent ? dotColor : "transparent",
                    borderWidth: 2,
                    borderColor: dotColor,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isDone && (
                    <Text style={{ color: theme.primaryForeground, fontSize: 10, fontWeight: "700" }}>
                      ✓
                    </Text>
                  )}
                </View>

                {/* Label — extends beyond the 18px column via marginLeft */}
                <Text
                  style={{
                    width: LABEL_WIDTH,
                    marginLeft: labelMarginLeft,
                    marginTop: 4,
                    fontSize: 10,
                    fontWeight: isCurrent || isDone ? "700" : "500",
                    color: labelColor,
                    textAlign: labelAlign,
                  }}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
                {step.timeLabel !== "" && (
                  <Text
                    style={{
                      width: LABEL_WIDTH,
                      marginLeft: labelMarginLeft,
                      marginTop: 1,
                      fontSize: 9,
                      color: theme.mutedForeground,
                      textAlign: labelAlign,
                    }}
                  >
                    {step.timeLabel}
                  </Text>
                )}
              </View>
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}
