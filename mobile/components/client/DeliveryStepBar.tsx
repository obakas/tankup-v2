import { View, Text } from "react-native";
import type { TankupTheme } from "@/components/ui/theme";
import {
  BATCH_FILL_TIMEOUT_MINUTES,
  LOADING_TIMEOUT_MINUTES,
  PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES,
  DELIVERY_TIMEOUT_HOURS,
} from "@/constants/timePolicy";

interface StepDef {
  key: string;
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
  { key: "searching", label: "Finding Tanker",  timeLabel: `≤ ${PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES} min` },
  { key: "delivery",  label: "En Route",        timeLabel: `≤ ${DELIVERY_TIMEOUT_HOURS} h` },
  { key: "completed", label: "Delivered",       timeLabel: "" },
];

interface DeliveryStepBarProps {
  currentStep: string;
  mode: "batch" | "priority";
  theme: TankupTheme;
}

export function DeliveryStepBar({ currentStep, mode, theme }: DeliveryStepBarProps) {
  const steps = mode === "priority" ? PRIORITY_STEPS : BATCH_STEPS;
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

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
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;
          const dotColor = isPast ? theme.success : isCurrent ? theme.primary : theme.border;
          const lineColor = i < currentIndex ? theme.success : theme.border;

          return (
            <View key={step.key} className="flex-row items-center flex-1">
              {/* Dot */}
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: isPast || isCurrent ? dotColor : "transparent",
                  borderWidth: 2,
                  borderColor: dotColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isPast && (
                  <Text style={{ color: theme.primaryForeground, fontSize: 10, fontWeight: "700" }}>
                    ✓
                  </Text>
                )}
              </View>

              {/* Connecting line (not after last step) */}
              {i < steps.length - 1 && (
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
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;
          const labelColor = isPast
            ? theme.success
            : isCurrent
            ? theme.primary
            : theme.mutedForeground;

          // Each label sits under its dot. The dots are spaced by flex-1 on the
          // connecting lines, so we mirror that with matching flex weights here.
          // First and last labels are pinned at the edges; middle labels are centered.
          const isFirst = i === 0;
          const isLast = i === steps.length - 1;
          const flex = i < steps.length - 1 ? 1 : 0;

          return (
            <View
              key={step.key}
              style={{
                flex,
                alignItems: isFirst ? "flex-start" : isLast ? "flex-end" : "center",
                // Offset the middle labels so they centre under their dot rather
                // than the midpoint of the flex segment.
                ...(isLast ? {} : {}),
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: isCurrent ? "700" : "500",
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
