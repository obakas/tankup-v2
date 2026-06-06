import { Text, View } from "react-native";
import { CheckCircle, Droplets, Layers, Lock, MapPin, Navigation, Truck } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

const FLOOR_LABELS: Record<string, string> = {
  ground: "Ground floor",
  first_floor: "1st floor",
  second_floor: "2nd floor",
  third_floor: "3rd floor",
  rooftop: "Rooftop",
};
const FLOOR_HOSE_HINTS: Record<string, string> = {
  ground: "~5–15m hose",
  first_floor: "~20–30m hose",
  second_floor: "~30–40m hose",
  third_floor: "~40–55m hose",
  rooftop: "55m+ hose",
};

export type SiteProfile = {
  label?: string | null;
  address?: string | null;
  landmark_notes?: string | null;
  tank_capacity_liters?: number | null;
  tank_floor_level?: string | null;
  hose_distance_m?: number | null;
  has_gate?: boolean;
  gate_notes?: string | null;
  road_difficulty?: number;
  parking_difficulty?: number;
  verification_status?: string | null;
  is_driver_verified?: boolean;
  last_verified_at?: string | null;
};

export function DifficultyDots({ value, max = 5 }: { value: number; max?: number }) {
  const { theme } = useAppTheme();
  const filled = Math.min(Math.max(value ?? 1, 1), max);
  const color = filled <= 2 ? theme.success : filled === 3 ? theme.warning : theme.destructive;
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: i < filled ? color : theme.border }}
        />
      ))}
    </View>
  );
}

type Props = {
  site: SiteProfile | null | undefined;
  volume?: number | null;
};

export function SiteCard({ site, volume }: Props) {
  const { theme } = useAppTheme();
  if (!site) return null;

  return (
    <View className="gap-2 mt-3">
      {(site.address || site.landmark_notes) && (
        <View className="flex-row items-start gap-2">
          <MapPin color={theme.mutedForeground} size={14} style={{ marginTop: 2 }} />
          <View className="flex-1">
            {site.address && (
              <Text className="text-sm" style={{ color: theme.foreground }}>{site.address}</Text>
            )}
            {site.landmark_notes && (
              <Text className="text-xs mt-0.5" style={{ color: theme.mutedForeground }}>
                {site.landmark_notes}
              </Text>
            )}
          </View>
        </View>
      )}

      <View className="flex-row flex-wrap gap-2">
        {volume != null && (
          <View
            className="flex-row items-center gap-1 rounded-lg px-2 py-1"
            style={{ backgroundColor: theme.cardSoft }}
          >
            <Droplets color={theme.success} size={12} />
            <Text className="text-xs font-semibold" style={{ color: theme.foreground }}>
              {volume.toLocaleString()}L
            </Text>
          </View>
        )}
        {site.tank_capacity_liters != null && (
          <View
            className="flex-row items-center gap-1 rounded-lg px-2 py-1"
            style={{ backgroundColor: theme.cardSoft }}
          >
            <Truck color={theme.mutedForeground} size={12} />
            <Text className="text-xs" style={{ color: theme.mutedForeground }}>
              Tank: {site.tank_capacity_liters.toLocaleString()}L cap
            </Text>
          </View>
        )}
        {site.hose_distance_m != null && (
          <View
            className="flex-row items-center gap-1 rounded-lg px-2 py-1"
            style={{ backgroundColor: theme.cardSoft }}
          >
            <Navigation color={theme.mutedForeground} size={12} />
            <Text className="text-xs" style={{ color: theme.mutedForeground }}>
              Hose: {site.hose_distance_m}m
            </Text>
          </View>
        )}
        {site.tank_floor_level != null && (
          <View
            className="flex-row items-center gap-1 rounded-lg px-2 py-1"
            style={{ backgroundColor: theme.cardSoft }}
          >
            <Layers color={theme.mutedForeground} size={12} />
            <Text className="text-xs" style={{ color: theme.mutedForeground }}>
              {FLOOR_LABELS[site.tank_floor_level] ?? site.tank_floor_level}
            </Text>
            <Text className="text-xs" style={{ color: theme.mutedForeground }}>
              · {FLOOR_HOSE_HINTS[site.tank_floor_level] ?? ""}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row gap-4">
        <View className="gap-1">
          <Text className="text-[10px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
            Road
          </Text>
          <DifficultyDots value={site.road_difficulty ?? 1} />
        </View>
        <View className="gap-1">
          <Text className="text-[10px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>
            Parking
          </Text>
          <DifficultyDots value={site.parking_difficulty ?? 1} />
        </View>
      </View>

      {site.verification_status && (
        <View className="flex-row items-center gap-1">
          <CheckCircle
            size={12}
            color={site.is_driver_verified ? theme.success : theme.mutedForeground}
          />
          <Text className="text-[11px] capitalize" style={{ color: site.is_driver_verified ? theme.success : theme.mutedForeground }}>
            {site.verification_status.replace(/_/g, " ")}
          </Text>
        </View>
      )}

      {site.has_gate && (
        <View
          className="flex-row items-start gap-2 rounded-lg px-3 py-2"
          style={{ backgroundColor: theme.warningSoft, borderWidth: 1, borderColor: theme.warning + "55" }}
        >
          <Lock color={theme.warning} size={13} style={{ marginTop: 1 }} />
          <View className="flex-1">
            <Text className="text-xs font-semibold" style={{ color: theme.warning }}>Gated site</Text>
            {site.gate_notes && (
              <Text className="text-xs mt-0.5" style={{ color: theme.mutedForeground }}>{site.gate_notes}</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
