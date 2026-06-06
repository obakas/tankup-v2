import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AlertTriangle, CheckCircle2, Droplets, Phone, User } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SiteCard } from "@/components/driver/SiteCard";
import { SafeMultiMapView } from "@/components/ui/SafeMapView";
import type { MultiMarker } from "@/components/ui/SafeMapView";

type Props = {
  offer: any;
  onAccept: () => void;
  onDecline: () => void;
  loading: boolean;
};

export function IncomingOfferStep({ offer, onAccept, onDecline, loading }: Props) {
  const { theme } = useAppTheme();
  const [secondsLeft, setSecondsLeft] = useState<number>(
    offer.seconds_left ?? offer.expires_in_seconds ?? 60
  );

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const isPriority = (offer.offer_type ?? offer.type) === "priority";
  const totalVolume = offer.total_volume_liters ?? offer.total_volume ?? offer.volume_liters ?? 0;
  const urgent = secondsLeft <= 15;

  const stopMarkers: MultiMarker[] = isPriority
    ? (offer.latitude != null && offer.longitude != null
      ? [{
          id: 0,
          lat: offer.latitude,
          lon: offer.longitude,
          title: offer.customer_name ?? "Customer",
          description: [offer.site?.address, `${offer.volume_liters ?? totalVolume}L`].filter(Boolean).join(" · "),
          pinColor: "#16a34a",
        }]
      : [])
    : (offer.stops ?? [])
        .filter((s: any) => s.latitude != null && s.longitude != null)
        .map((s: any, i: number) => ({
          id: s.id ?? i,
          lat: s.latitude,
          lon: s.longitude,
          title: s.name ?? `Stop ${i + 1}`,
          description: [s.address, `${s.volume_liters ?? ""}L`].filter(Boolean).join(" · "),
          pinColor: "#16a34a",
        }));

  return (
    <View className="gap-4">
      {/* Header */}
      <View
        className="rounded-2xl p-5"
        style={{
          backgroundColor: theme.warningSoft,
          borderWidth: 1,
          borderColor: urgent ? theme.destructive : theme.warning,
        }}
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <View
              className="rounded-lg px-2 py-1"
              style={{ backgroundColor: isPriority ? theme.destructive + "22" : theme.success + "22" }}
            >
              <Text
                className="text-xs font-bold uppercase"
                style={{ color: isPriority ? theme.destructive : theme.success }}
              >
                {isPriority ? "Priority" : "Batch"}
              </Text>
            </View>
            <Text className="text-xs font-bold uppercase" style={{ color: theme.warning }}>
              New Offer
            </Text>
          </View>
          <View className="items-end">
            <Text
              className="text-2xl font-extrabold"
              style={{ color: urgent ? theme.destructive : theme.warning }}
            >
              {secondsLeft}s
            </Text>
            <Text className="text-[10px]" style={{ color: theme.mutedForeground }}>remaining</Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center gap-2">
          <Droplets color={theme.foreground} size={20} />
          <Text className="text-2xl font-extrabold" style={{ color: theme.foreground }}>
            {(totalVolume as number).toLocaleString()}L
          </Text>
          {!isPriority && offer.stops?.length > 0 && (
            <Text className="text-base" style={{ color: theme.mutedForeground }}>
              · {offer.stops.length} {offer.stops.length === 1 ? "stop" : "stops"}
            </Text>
          )}
        </View>
      </View>

      {/* Stop locations map */}
      {stopMarkers.length > 0 && (
        <SafeMultiMapView
          markers={stopMarkers}
          initialLat={stopMarkers[0].lat}
          initialLon={stopMarkers[0].lon}
          height={200}
        />
      )}

      {/* Priority — single customer + site */}
      {isPriority && (
        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View className="flex-row items-center gap-2 mb-1">
            <User color={theme.success} size={15} />
            <Text className="font-bold" style={{ color: theme.foreground }}>
              {offer.customer_name ?? "Customer"}
            </Text>
            {offer.customer_phone && (
              <View className="flex-row items-center gap-1 ml-auto">
                <Phone color={theme.mutedForeground} size={13} />
                <Text className="text-xs" style={{ color: theme.mutedForeground }}>
                  {offer.customer_phone}
                </Text>
              </View>
            )}
          </View>
          <SiteCard site={offer.site} volume={offer.volume_liters} />
          {!offer.site && (
            <View className="flex-row items-center gap-2 mt-2">
              <AlertTriangle color={theme.mutedForeground} size={13} />
              <Text className="text-xs" style={{ color: theme.mutedForeground }}>
                No site profile — confirm details on arrival
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Batch — per-stop breakdown */}
      {!isPriority && offer.stops?.map((stop: any, idx: number) => (
        <View
          key={stop.id ?? idx}
          className="rounded-2xl p-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View className="flex-row items-center gap-2">
            <View
              className="w-6 h-6 rounded-full items-center justify-center"
              style={{ backgroundColor: theme.success }}
            >
              <Text className="text-xs font-bold" style={{ color: theme.primaryForeground }}>
                {idx + 1}
              </Text>
            </View>
            <Text className="font-semibold flex-1" style={{ color: theme.foreground }}>
              {stop.name ?? `Stop ${idx + 1}`}
            </Text>
            {stop.phone && (
              <View className="flex-row items-center gap-1">
                <Phone color={theme.mutedForeground} size={12} />
                <Text className="text-xs" style={{ color: theme.mutedForeground }}>{stop.phone}</Text>
              </View>
            )}
          </View>
          <SiteCard
            site={{
              address: stop.address,
              landmark_notes: stop.landmark_notes,
              tank_capacity_liters: stop.tank_capacity_liters,
              tank_floor_level: stop.tank_floor_level,
              hose_distance_m: stop.hose_distance_m,
              has_gate: stop.has_gate,
              gate_notes: stop.gate_notes,
              road_difficulty: stop.road_difficulty,
              parking_difficulty: stop.parking_difficulty,
              verification_status: stop.verification_status,
              is_driver_verified: stop.is_driver_verified,
              last_verified_at: stop.last_verified_at,
            }}
            volume={stop.volume_liters}
          />
        </View>
      ))}

      {/* Batch — no stops fallback */}
      {!isPriority && (!offer.stops || offer.stops.length === 0) && (
        <View
          className="rounded-2xl p-4 flex-row items-center gap-2"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <AlertTriangle color={theme.mutedForeground} size={14} />
          <Text className="text-sm" style={{ color: theme.mutedForeground }}>
            Stop details not available — confirm volumes at the depot
          </Text>
        </View>
      )}

      {/* Actions */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={onDecline}
          disabled={loading}
          className="flex-1 rounded-xl py-4 items-center"
          style={{ borderWidth: 1, borderColor: theme.border }}
        >
          <Text className="font-medium" style={{ color: theme.foreground }}>Decline</Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          disabled={loading}
          className="flex-1 rounded-xl py-4 items-center"
          style={{ backgroundColor: theme.success }}
        >
          {loading ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <View className="flex-row items-center gap-2">
              <CheckCircle2 color={theme.primaryForeground} size={16} />
              <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Accept</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
