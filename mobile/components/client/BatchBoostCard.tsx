import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Zap } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

const PRESET_VOLUMES = [500, 1000, 2000, 5000];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type UrgencyLevel = "calm" | "warning" | "critical";

function getUrgency(seconds: number | null | undefined): UrgencyLevel {
  if (seconds == null) return "calm";
  if (seconds < 600) return "critical";
  if (seconds < 1800) return "warning";
  return "calm";
}

type Props = {
  remainingCapacity: number;
  boostCostPerLiter: number;
  timeUntilExpirySeconds?: number | null;
  onBoost: (additionalVolume: number) => void;
  isLoading?: boolean;
};

export function BatchBoostCard({
  remainingCapacity,
  boostCostPerLiter,
  timeUntilExpirySeconds,
  onBoost,
  isLoading,
}: Props) {
  const { theme } = useAppTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(timeUntilExpirySeconds ?? null);

  useEffect(() => {
    const initial = timeUntilExpirySeconds ?? null;
    setCountdown(initial);
    if (initial == null || initial <= 0) return undefined;
    const id = setInterval(() => {
      setCountdown((prev) => (prev != null && prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [timeUntilExpirySeconds]);

  const urgency = getUrgency(countdown);

  const borderColor =
    urgency === "critical" ? theme.destructive :
    urgency === "warning" ? "#f97316" :
    "#f59e0b";

  const accentColor =
    urgency === "critical" ? theme.destructive :
    urgency === "warning" ? "#f97316" :
    "#d97706";

  const softBg =
    urgency === "critical" ? theme.destructiveSoft :
    urgency === "warning" ? "rgba(249,115,22,0.10)" :
    "rgba(245,158,11,0.10)";

  const headline =
    urgency === "critical"
      ? "Last chance — batch filling fast!"
      : urgency === "warning"
      ? `Only ${countdown != null ? formatCountdown(countdown) : "—"} left — boost now!`
      : "Boost your batch for faster delivery";

  const presets = PRESET_VOLUMES.filter((v) => v <= remainingCapacity);
  if (presets.length === 0) return null;

  return (
    <View
      className="rounded-3xl p-5"
      style={{ backgroundColor: softBg, borderWidth: 1.5, borderColor }}
    >
      <View className="flex-row items-center gap-2 mb-1">
        <Zap color={accentColor} size={18} fill={accentColor} />
        <Text className="text-base font-bold" style={{ color: accentColor }}>
          {urgency === "calm" ? "Want faster dispatch?" : "Boost Your Batch"}
        </Text>
      </View>

      <Text className="text-sm leading-5 mb-1" style={{ color: theme.mutedForeground }}>
        {headline}
      </Text>

      {countdown != null && urgency === "calm" && (
        <Text className="text-xs mb-3" style={{ color: theme.mutedForeground }}>
          {formatCountdown(countdown)} remaining
        </Text>
      )}

      <Text className="text-xs mb-3" style={{ color: theme.mutedForeground }}>
        {remainingCapacity.toLocaleString()}L still available in this batch. Claim more water to push it toward dispatch.
      </Text>

      <View className="flex-row flex-wrap gap-2 mb-4">
        {presets.map((vol) => {
          const cost = boostCostPerLiter * vol;
          const isSelected = selected === vol;
          return (
            <Pressable
              key={vol}
              onPress={() => setSelected(vol)}
              className="rounded-xl px-3 py-2 items-center"
              style={{
                borderWidth: 1.5,
                borderColor: isSelected ? accentColor : theme.border,
                backgroundColor: isSelected ? softBg : theme.card,
              }}
            >
              <Text className="text-sm font-bold" style={{ color: isSelected ? accentColor : theme.foreground }}>
                +{vol.toLocaleString()}L
              </Text>
              <Text className="text-xs" style={{ color: theme.mutedForeground }}>
                ₦{cost.toLocaleString()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => { if (selected) onBoost(selected); }}
        disabled={!selected || isLoading}
        className="flex-row items-center justify-center gap-2 rounded-xl py-3"
        style={{
          backgroundColor: accentColor,
          opacity: selected && !isLoading ? 1 : 0.5,
        }}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Zap color="#fff" size={16} fill="#fff" />
            <Text className="font-bold" style={{ color: "#fff" }}>
              {selected ? `Boost +${selected.toLocaleString()}L` : "Select an amount above"}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
