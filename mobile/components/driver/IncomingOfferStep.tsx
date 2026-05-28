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
      <View className="bg-warning/10 border border-warning rounded-2xl p-5">
        <View className="flex-row justify-between items-center">
          <Text className="text-warning font-bold uppercase text-xs">New Offer</Text>
          <Text className="text-warning font-bold">{secondsLeft}s</Text>
        </View>
        <Text className="text-foreground text-xl font-bold mt-2 capitalize">
          {offer.job_type ?? offer.delivery_type} • {(offer.total_volume_liters ?? offer.volume_liters ?? 0).toLocaleString()}L
        </Text>
        {offer.stops?.length > 0 && <Text className="text-muted-foreground mt-1">{offer.stops.length} stops</Text>}
      </View>

      {offer.stops?.map((stop: any, idx: number) => (
        <View key={stop.id ?? idx} className="bg-card border border-border rounded-xl p-4">
          <View className="flex-row items-center gap-2">
            <View className="w-6 h-6 rounded-full bg-success items-center justify-center">
              <Text className="text-white text-xs font-bold">{idx + 1}</Text>
            </View>
            <Text className="text-foreground font-semibold flex-1">{stop.name ?? `Stop ${idx + 1}`}</Text>
            <Text className="text-muted-foreground">{stop.volume_liters ?? stop.volumeLiters}L</Text>
          </View>
          {stop.address && (
            <View className="flex-row items-center gap-2 mt-1">
              <MapPin color={theme.mutedForeground} size={12} />
              <Text className="text-muted-foreground text-xs">{stop.address}</Text>
            </View>
          )}
        </View>
      ))}

      <View className="flex-row gap-3">
        <Pressable onPress={onDecline} disabled={loading} className="flex-1 border border-border rounded-xl py-4 items-center">
          <Text className="text-foreground font-medium">Decline</Text>
        </Pressable>
        <Pressable onPress={onAccept} disabled={loading} className="flex-1 bg-success rounded-xl py-4 items-center">
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Accept</Text>}
        </Pressable>
      </View>
    </View>
  );
}
