import { View, Text } from "react-native";
import type { TankupTheme } from "@/components/ui/theme";
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
  mode: "batch" | "priority",
  liveData: any,
  fallbackStep: string,
): number {
  if (!liveData) {
    if (fallbackStep === "batch" || fallbackStep === "searching") return 0;
    if (fallbackStep === "tanker") return 1;
    if (fallbackStep === "delivery") return 2;
    if (fallbackStep === "completed") return 4;
    return 0;
  }

  if (mode === "batch") {
    const batchStatus: string = liveData.status ?? "";
    const memberStatus: string = liveData.member_delivery_status ?? "";

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

  // priority
  const reqStatus: string = liveData.request_status ?? "";
  const deliveryStatus: string = liveData.delivery_status ?? "";
  const tankerStatus: string = liveData.tanker_status ?? "";

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
        paddingBottom: 12,
      }}
    >
      {/* Dot + line row */}
      <View className="flex-row items-center">
        {steps.map((step, i) => {
          const isDone = i < currentIndex || (i === currentIndex && i === steps.length - 1);
          const isCurrent = i === currentIndex && i < steps.length - 1;
          const dotColor = isDone ? theme.success : isCurrent ? theme.primary : theme.border;
          const lineColor = i < currentIndex ? theme.success : theme.border;
          const isLast = i === steps.length - 1;

          return (
            <View key={i} className="flex-row items-center flex-1">
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
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

              {!isLast && (
                <View
                  className="flex-1"
                  style={{ height: 2, backgroundColor: lineColor }}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Label row */}
      <View className="flex-row" style={{ marginTop: 6 }}>
        {steps.map((step, i) => {
          const isDone = i < currentIndex || (i === currentIndex && i === steps.length - 1);
          const isCurrent = i === currentIndex && i < steps.length - 1;
          const labelColor = isDone
            ? theme.success
            : isCurrent
            ? theme.primary
            : theme.mutedForeground;
          const isFirst = i === 0;
          const isLast = i === steps.length - 1;

          return (
            <View
              key={i}
              style={{
                flex: isLast ? 0 : 1,
                alignItems: isFirst ? "flex-start" : isLast ? "flex-end" : "center",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: isCurrent || isDone ? "700" : "500",
                  color: labelColor,
                }}
                numberOfLines={1}
              >
                {step.label}
              </Text>
              {step.timeLabel !== "" && (
                <Text style={{ fontSize: 9, color: theme.mutedForeground, marginTop: 1 }}>
                  {step.timeLabel}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
