import { View, Text } from "react-native";
import type { RequestMode } from "@/types/client";
import type { CreateRequestResponse } from "@/lib/api";

type Props = {
  mode: RequestMode;
  liveData: any;
  requestResp: CreateRequestResponse | null;
};

export function TankerStep({ mode, liveData }: Props) {
  const driverName = liveData?.driver_name ?? liveData?.tanker?.driver_name ?? "Driver";
  const tankerStatus = liveData?.status ?? liveData?.tanker?.status ?? "assigned";
  const myStop = liveData?.your_stop ?? liveData?.member;

  return (
    <View className="gap-4">
      <View className="bg-card border border-border rounded-2xl p-5">
        <Text className="text-foreground font-semibold mb-2">Tanker assigned</Text>
        <Text className="text-muted-foreground text-sm">Driver: {driverName}</Text>
        <Text className="text-muted-foreground text-sm mt-1 capitalize">
          Status: {tankerStatus}
        </Text>
      </View>

      {mode === "batch" && myStop && (
        <View className="bg-card border border-primary/40 rounded-2xl p-5">
          <Text className="text-muted-foreground text-xs uppercase tracking-wider">
            Your stop
          </Text>
          <Text className="text-foreground text-lg font-bold mt-1">
            Stop #{myStop.stop_order ?? "—"}
          </Text>
          <Text className="text-muted-foreground text-sm mt-1">
            OTP: {myStop.delivery_code ?? "—"}
          </Text>
        </View>
      )}

      {mode === "priority" && (
        <View className="bg-card border border-border rounded-2xl p-5">
          <Text className="text-muted-foreground text-sm">
            Your tanker is loading and will head to you shortly.
          </Text>

          {liveData?.delivery_code && (
            <Text className="text-foreground text-3xl font-bold tracking-widest mt-3 text-center">
              {liveData.delivery_code}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}