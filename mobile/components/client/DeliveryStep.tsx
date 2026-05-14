import { View, Text } from "react-native";
import type { RequestMode } from "@/types/client";
import type { CreateRequestResponse } from "@/lib/api";

type Props = {
  mode: RequestMode;
  liveData: any;
  requestResp: CreateRequestResponse;
};

export function DeliveryStep({ mode, liveData }: Props) {
  const myStop = liveData?.your_stop ?? liveData?.member ?? liveData;
  const otp = myStop?.delivery_code ?? "—";
  const stopStatus = myStop?.delivery_status ?? myStop?.status ?? "";
  const position = myStop?.stop_order ?? myStop?.queue_position;
  const totalStops = liveData?.total_stops ?? liveData?.member_count;

  return (
    <View className="gap-4">
      {mode === "batch" && position != null && (
        <View className="bg-card border border-primary/40 rounded-2xl p-5">
          <Text className="text-muted-foreground text-xs uppercase tracking-wider">
            Batch queue
          </Text>

          <Text className="text-foreground text-xl font-bold mt-1">
            {position === 1 ? "You're up now!" : `Stop #${position}`}
          </Text>

          {totalStops && (
            <Text className="text-muted-foreground text-sm mt-1">
              Position {position} of {totalStops} stops
            </Text>
          )}
        </View>
      )}

      <View className="bg-card border border-border rounded-2xl p-5 items-center">
        <Text className="text-muted-foreground text-sm">
          Your OTP — share with driver
        </Text>

        <Text className="text-foreground text-4xl font-bold tracking-widest mt-2">
          {otp}
        </Text>

        {stopStatus && (
          <Text className="text-muted-foreground text-xs mt-3 capitalize">
            Stop status: {stopStatus.replace(/_/g, " ")}
          </Text>
        )}
      </View>
    </View>
  );
}