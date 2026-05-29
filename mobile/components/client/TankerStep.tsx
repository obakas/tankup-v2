import { View, Text } from "react-native";
import type { RequestMode } from "@/types/client";
import type { CreateRequestResponse } from "@/lib/api";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  mode: RequestMode;
  liveData: any;
  requestResp: CreateRequestResponse | null;
};

export function TankerStep({ mode, liveData }: Props) {
  const { theme } = useAppTheme();
  const driverName = liveData?.driver_name ?? liveData?.tanker?.driver_name ?? "Driver";
  const tankerStatus = liveData?.status ?? liveData?.tanker?.status ?? "assigned";
  const myStop = liveData?.your_stop ?? liveData?.member;

  return (
    <View className="gap-4">
      <View
        className="rounded-2xl p-5"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
      >
        <Text className="font-semibold mb-2" style={{ color: theme.foreground }}>Tanker assigned</Text>
        <Text className="text-sm" style={{ color: theme.mutedForeground }}>Driver: {driverName}</Text>
        <Text className="text-sm mt-1 capitalize" style={{ color: theme.mutedForeground }}>
          Status: {tankerStatus}
        </Text>
      </View>

      {mode === "batch" && myStop && (
        <View
          className="rounded-2xl p-5"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.primary + "66" }}
        >
          <Text className="text-xs uppercase tracking-wider" style={{ color: theme.mutedForeground }}>
            Your stop
          </Text>
          <Text className="text-lg font-bold mt-1" style={{ color: theme.foreground }}>
            Stop #{myStop.stop_order ?? "—"}
          </Text>
          <Text className="text-sm mt-1" style={{ color: theme.mutedForeground }}>
            OTP: {myStop.delivery_code ?? "—"}
          </Text>
        </View>
      )}

      {mode === "priority" && (
        <View
          className="rounded-2xl p-5"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <Text className="text-sm" style={{ color: theme.mutedForeground }}>
            Your tanker is loading and will head to you shortly.
          </Text>
          {liveData?.delivery_code && (
            <Text className="text-3xl font-bold tracking-widest mt-3 text-center" style={{ color: theme.foreground }}>
              {liveData.delivery_code}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
