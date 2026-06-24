import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AlertTriangle, CheckCircle2, Droplets, Phone, User } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SiteCard } from "@/components/driver/SiteCard";

type Props = {
  offer: any;
  onAccept: () => void;
  onDecline: () => void;
  loading: boolean;
};

const HIGH_ELEVATION = ["second_floor", "third_floor", "rooftop"];
const FLOOR_NAME: Record<string, string> = {
  second_floor: "2nd floor",
  third_floor: "3rd floor",
  rooftop: "rooftop",
};

function getSiteRisk(site: any): { level: "danger" | "warning"; lines: string[] } | null {
  if (!site) return null;
  const lines: string[] = [];
  let level: "danger" | "warning" = "warning";

  if (site.tank_floor_level && HIGH_ELEVATION.includes(site.tank_floor_level)) {
    level = "danger";
    lines.push(
      `Tank on ${FLOOR_NAME[site.tank_floor_level] ?? site.tank_floor_level} — pump strain expected`
    );
  }
  if (site.hose_distance_m != null && site.hose_distance_m > 35) {
    lines.push(`Long hose run: ${site.hose_distance_m}m`);
  }
  if (site.road_difficulty != null && site.road_difficulty >= 4) {
    lines.push("Very rough road access");
  }

  return lines.length > 0 ? { level, lines } : null;
}

function SiteRiskBanner({ site }: { site: any }) {
  const { theme } = useAppTheme();
  const risk = getSiteRisk(site);
  if (!risk) return null;

  const color = risk.level === "danger" ? theme.destructive : theme.warning;
  const bg = risk.level === "danger" ? theme.destructive + "15" : theme.warningSoft;
  const border = color + "55";

  return (
    <View
      className="flex-row items-start gap-2 rounded-xl px-3 py-2 mt-1"
      style={{ backgroundColor: bg, borderWidth: 1, borderColor: border }}
    >
      <AlertTriangle color={color} size={14} style={{ marginTop: 1 }} />
      <View className="flex-1 gap-0.5">
        {risk.lines.map((line, i) => (
          <Text key={i} className="text-xs font-medium" style={{ color }}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

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

        {/* Pre-paid badge */}
        {offer.payment_confirmed && (
          <View className="flex-row items-center gap-1.5 mt-2">
            <CheckCircle2 color={theme.success} size={14} />
            <Text className="text-xs font-semibold" style={{ color: theme.success }}>
              Customer pre-paid — no payment collection needed
            </Text>
          </View>
        )}

        {/* Earnings breakdown */}
        {offer.estimated_earnings_naira != null && (
          <View
            className="mt-3 rounded-xl p-3"
            style={{ backgroundColor: theme.success + "15", borderWidth: 1, borderColor: theme.success + "40" }}
          >
            {isPriority ? (
              <View className="flex-row items-baseline gap-1">
                <Text className="text-xl font-extrabold" style={{ color: theme.success }}>
                  ₦{(offer.estimated_earnings_naira as number).toLocaleString()}
                </Text>
                <Text className="text-xs" style={{ color: theme.success }}>estimated earnings</Text>
              </View>
            ) : (
              <>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-xl font-extrabold" style={{ color: theme.success }}>
                    ₦{(offer.estimated_earnings_naira as number).toLocaleString()}
                  </Text>
                  <Text className="text-xs" style={{ color: theme.mutedForeground }}>delivery pay</Text>
                </View>
                {offer.stop_bonus_naira != null && (offer.stop_bonus_naira as number) > 0 && (
                  <View className="flex-row items-baseline gap-1 mt-0.5">
                    <Text className="text-base font-bold" style={{ color: theme.success }}>
                      + ₦{(offer.stop_bonus_naira as number).toLocaleString()}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.mutedForeground }}>
                      batch bonus ({offer.stops?.length ?? 0} {(offer.stops?.length ?? 0) === 1 ? "stop" : "stops"})
                    </Text>
                  </View>
                )}
                <View
                  className="mt-1.5 pt-1.5"
                  style={{ borderTopWidth: 1, borderColor: theme.success + "30" }}
                >
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-base font-semibold" style={{ color: theme.success }}>
                      ₦{((offer.estimated_earnings_naira as number) + ((offer.stop_bonus_naira as number) ?? 0)).toLocaleString()}
                    </Text>
                    <Text className="text-xs font-semibold" style={{ color: theme.success }}>total</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}
      </View>

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
          <SiteRiskBanner site={offer.site} />
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
              tank_photo_url: stop.tank_photo_url,
            }}
            volume={stop.volume_liters}
          />
          <SiteRiskBanner site={stop} />
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
