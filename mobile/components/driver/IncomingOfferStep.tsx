import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  offer: any;
  onAccept: () => void;
  onDecline: () => void;
  loading: boolean;
};

export function IncomingOfferStep({ offer, onAccept, onDecline, loading }: Props) {
  const { theme } = useAppTheme();
  const [secondsLeft, setSecondsLeft] = useState<number>(offer.seconds_left ?? 60);

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <View className="gap-4">
      <View
        className="rounded-2xl p-5"
        style={{ backgroundColor: theme.warningSoft, borderWidth: 1, borderColor: theme.warning }}
      >
        <View className="flex-row justify-between items-center">
          <Text className="font-bold uppercase text-xs" style={{ color: theme.warning }}>New Offer</Text>
          <Text className="font-bold" style={{ color: theme.warning }}>{secondsLeft}s</Text>
        </View>
        <Text className="text-xl font-bold mt-2 capitalize" style={{ color: theme.foreground }}>
          {offer.job_type ?? offer.delivery_type} • {(offer.total_volume_liters ?? offer.volume_liters ?? 0).toLocaleString()}L
        </Text>
        {offer.stops?.length > 0 && (
          <Text className="mt-1" style={{ color: theme.mutedForeground }}>{offer.stops.length} stops</Text>
        )}
      </View>

      {offer.stops?.map((stop: any, idx: number) => (
        <View
          key={stop.id ?? idx}
          className="rounded-xl p-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View className="flex-row items-center gap-2">
            <View
              className="w-6 h-6 rounded-full items-center justify-center"
              style={{ backgroundColor: theme.success }}
            >
              <Text className="text-xs font-bold" style={{ color: theme.primaryForeground }}>{idx + 1}</Text>
            </View>
            <Text className="font-semibold flex-1" style={{ color: theme.foreground }}>
              {stop.name ?? `Stop ${idx + 1}`}
            </Text>
            <Text style={{ color: theme.mutedForeground }}>{stop.volume_liters ?? stop.volumeLiters}L</Text>
          </View>
          {stop.address && (
            <View className="flex-row items-center gap-2 mt-1">
              <MapPin color={theme.mutedForeground} size={12} />
              <Text className="text-xs" style={{ color: theme.mutedForeground }}>{stop.address}</Text>
            </View>
          )}
        </View>
      ))}

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
            <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Accept</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
