import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { CalendarClock, Clock, XCircle } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  scheduledFor: string;
  liveLoading: boolean;
  onCancel: () => void;
};

function formatBlock(scheduledFor: string): string {
  if (!scheduledFor) return "your scheduled window";
  const d = new Date(scheduledFor);
  if (isNaN(d.getTime())) return "your scheduled window";
  const hour = d.getHours();
  const block = hour < 12 ? "Morning (7am – 12pm)" : "Afternoon (12pm – 5pm)";
  const day = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return `${day} · ${block}`;
}

export function ScheduledStep({ scheduledFor, liveLoading, onCancel }: Props) {
  const { theme } = useAppTheme();
  const text = { color: theme.foreground };
  const mutedText = { color: theme.mutedForeground };

  return (
    <View className="gap-6">
      <View className="items-center py-6">
        <View style={{ backgroundColor: theme.primarySoft }} className="w-20 h-20 rounded-2xl items-center justify-center mb-4">
          <CalendarClock size={40} color={theme.primary} />
        </View>

        <Text style={text} className="text-xl font-bold text-center">
          Delivery Scheduled
        </Text>
        <Text style={mutedText} className="text-sm mt-2 text-center">
          Your payment is confirmed. We'll start searching for a driver when your window opens.
        </Text>
      </View>

      <View style={{ backgroundColor: theme.card, borderColor: theme.border }} className="rounded-xl border p-5 gap-3">
        <View className="flex-row items-center gap-3">
          <View style={{ backgroundColor: theme.primarySoft }} className="w-10 h-10 rounded-xl items-center justify-center">
            <Clock size={20} color={theme.primary} />
          </View>
          <View className="flex-1">
            <Text style={mutedText} className="text-xs">Your delivery window</Text>
            <Text style={text} className="font-semibold mt-0.5">
              {formatBlock(scheduledFor)}
            </Text>
          </View>
        </View>

        <View style={{ borderTopColor: theme.border }} className="border-t pt-3">
          <Text style={mutedText} className="text-xs">
            We'll notify you when a driver is confirmed. No need to keep the app open.
          </Text>
        </View>
      </View>

      {liveLoading && (
        <View className="flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color={theme.mutedForeground} />
          <Text style={mutedText} className="text-sm">Checking status…</Text>
        </View>
      )}

      <Pressable
        onPress={onCancel}
        style={{ borderColor: theme.border, backgroundColor: theme.card }}
        className="rounded-xl border py-4 items-center flex-row justify-center gap-2"
      >
        <XCircle size={18} color={theme.destructive} />
        <Text style={{ color: theme.destructive }} className="font-semibold">
          Cancel Scheduled Delivery
        </Text>
      </Pressable>

      <Text style={mutedText} className="text-xs text-center">
        You can cancel before your window opens for a full refund.
      </Text>
    </View>
  );
}
