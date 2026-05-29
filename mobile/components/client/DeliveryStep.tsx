import { View, Text } from "react-native";
import type { RequestMode } from "@/types/client";
import type { CreateRequestResponse } from "@/lib/api";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  mode: RequestMode;
  liveData: any;
  requestResp: CreateRequestResponse;
};

export function DeliveryStep({ mode, liveData }: Props) {
  const { theme } = useAppTheme();
  const myStop = liveData?.your_stop ?? liveData?.member ?? liveData;
  const otp = myStop?.delivery_code ?? "—";
  const stopStatus = myStop?.delivery_status ?? myStop?.status ?? "";
  const position = myStop?.stop_order ?? myStop?.queue_position;
  const totalStops = liveData?.total_stops ?? liveData?.member_count;

  return (
    <View className="gap-4">
      {mode === "batch" && position != null && (
        <View
          className="rounded-2xl p-5"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.primary + "66" }}
        >
          <Text className="text-xs uppercase tracking-wider" style={{ color: theme.mutedForeground }}>
            Batch queue
          </Text>
          <Text className="text-xl font-bold mt-1" style={{ color: theme.foreground }}>
            {position === 1 ? "You're up now!" : `Stop #${position}`}
          </Text>
          {totalStops && (
            <Text className="text-sm mt-1" style={{ color: theme.mutedForeground }}>
              Position {position} of {totalStops} stops
            </Text>
          )}
        </View>
      )}

      <View
        className="rounded-2xl p-5 items-center"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Text className="text-sm" style={{ color: theme.mutedForeground }}>
          Your OTP — share with driver
        </Text>
        <Text className="text-4xl font-bold tracking-widest mt-2" style={{ color: theme.foreground }}>
          {otp}
        </Text>
        {stopStatus && (
          <Text className="text-xs mt-3 capitalize" style={{ color: theme.mutedForeground }}>
            Stop status: {stopStatus.replace(/_/g, " ")}
          </Text>
        )}
      </View>
    </View>
  );
}
