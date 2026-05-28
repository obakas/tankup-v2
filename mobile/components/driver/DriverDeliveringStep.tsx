import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { MapPin, Navigation, RefreshCw } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { DriverResponse } from "@/lib/api";
import {
  arriveAtStop,
  completeStop,
  confirmOtp,
  failStop,
  finishMeasurement,
  skipStop,
  startMeasurement,
} from "@/lib/api";

type Props = {
  driver: DriverResponse;
  job: any;
  currentStop: any;
  onRefresh: () => void;
  onCompleteJob: () => void;
  actionLoading: boolean;
  setError: (e: string | null) => void;
};

export function DriverDeliveringStep({
  driver,
  currentStop,
  onRefresh,
  onCompleteJob,
  actionLoading,
  setError,
}: Props) {
  const stop = currentStop?.current_stop ?? currentStop?.stop;
  const summary = currentStop?.stop_summary ?? [];
  const deliveredCount = summary.filter((s: any) => s.status === "delivered").length;
  const totalCount = summary.length;
  const allDone = totalCount > 0 && deliveredCount === totalCount;
  const stopStatus: string = stop?.delivery_status ?? "";

  const { theme } = useAppTheme();
  const [otpInput, setOtpInput] = useState("");
  const [meterStart, setMeterStart] = useState("");
  const [meterEnd, setMeterEnd] = useState("");
  const [stopLoading, setStopLoading] = useState(false);

  const doAction = async (fn: () => Promise<any>) => {
    setStopLoading(true);
    setError(null);

    try {
      await fn();
      await onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStopLoading(false);
    }
  };

  if (totalCount === 0 && !stop) {
    return (
      <View className="gap-4">
        <View className="bg-card border border-border rounded-2xl p-8 items-center gap-4">
          <View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: theme.primarySoft }}
          >
            <Navigation color={theme.primary} size={36} />
          </View>
          <View className="items-center gap-1">
            <Text className="text-foreground font-bold text-xl">No stops yet</Text>
            <Text className="text-muted-foreground text-center text-sm leading-5">
              Stops will appear here once the job is dispatched. Refresh to check for updates.
            </Text>
          </View>
        </View>
        <Pressable onPress={onRefresh} className="flex-row items-center justify-center gap-2 border border-border rounded-xl py-3">
          <RefreshCw color={theme.mutedForeground} size={16} />
          <Text className="text-muted-foreground font-medium">Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {totalCount > 0 && (
        <View className="bg-card border border-border rounded-2xl p-4">
          <View className="flex-row justify-between mb-2">
            <Text className="text-foreground font-semibold">Progress</Text>
            <Text className="text-primary font-bold">{deliveredCount}/{totalCount}</Text>
          </View>
          <View className="h-2 bg-border rounded-full overflow-hidden">
            <View className="h-full bg-success" style={{ width: `${totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0}%` }} />
          </View>
        </View>
      )}

      {summary.map((s: any, idx: number) => (
        <View
          key={s.delivery_id ?? idx}
          className={`bg-card border rounded-xl p-3 ${s.delivery_id === stop?.id ? "border-primary" : "border-border"} ${s.status === "delivered" ? "opacity-50" : ""}`}
        >
          <View className="flex-row items-center gap-2">
            <View className={`w-6 h-6 rounded-full items-center justify-center ${s.status === "delivered" ? "bg-success" : "bg-primary"}`}>
              <Text className="text-white text-xs font-bold">{s.status === "delivered" ? "✓" : idx + 1}</Text>
            </View>
            <Text className="text-foreground font-medium flex-1">{s.customer_name ?? `Stop ${idx + 1}`}</Text>
            <Text className="text-muted-foreground text-xs capitalize">{s.status?.replace(/_/g, " ")}</Text>
          </View>
        </View>
      ))}

      {stop && !allDone && (
        <View className="bg-card border border-primary/40 rounded-2xl p-5 gap-3">
          <Text className="text-foreground font-semibold">Current stop: {stop.customer_name ?? "—"}</Text>

          {stop.address && (
            <View className="flex-row items-center gap-2">
              <MapPin color={theme.mutedForeground} size={14} />
              <Text className="text-muted-foreground text-sm">{stop.address}</Text>
            </View>
          )}

          <Text className="text-muted-foreground text-xs capitalize">Status: {stopStatus.replace(/_/g, " ")}</Text>

          {(stopStatus === "en_route" || stopStatus === "pending") && (
            <Pressable disabled={stopLoading} onPress={() => doAction(() => arriveAtStop(stop.id, driver.tankerId))} className="bg-primary rounded-xl py-3 items-center">
              {stopLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">I've Arrived</Text>}
            </Pressable>
          )}

          {stopStatus === "arrived" && (
            <View className="gap-2">
              <Text className="text-muted-foreground text-sm">Meter start reading</Text>
              <TextInput
                value={meterStart}
                onChangeText={setMeterStart}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.mutedForeground}
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
              />
              <Pressable
                disabled={stopLoading || !meterStart}
                onPress={() => doAction(() => startMeasurement(stop.id, driver.tankerId, parseFloat(meterStart)))}
                className="bg-primary rounded-xl py-3 items-center"
              >
                {stopLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Start Measurement</Text>}
              </Pressable>
            </View>
          )}

          {stopStatus === "measuring" && (
            <View className="gap-2">
              <Text className="text-muted-foreground text-sm">Meter end reading</Text>
              <TextInput
                value={meterEnd}
                onChangeText={setMeterEnd}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.mutedForeground}
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
              />
              <Pressable
                disabled={stopLoading || !meterEnd}
                onPress={() => doAction(() => finishMeasurement(stop.id, driver.tankerId, parseFloat(meterEnd)))}
                className="bg-primary rounded-xl py-3 items-center"
              >
                {stopLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Finish Measurement</Text>}
              </Pressable>
            </View>
          )}

          {stopStatus === "awaiting_otp" && !stop.otp_verified && (
            <View className="gap-2">
              <Text className="text-muted-foreground text-sm">Customer OTP</Text>
              <TextInput
                value={otpInput}
                onChangeText={setOtpInput}
                keyboardType="number-pad"
                placeholder="0000"
                placeholderTextColor={theme.mutedForeground}
                maxLength={6}
                className="bg-background border border-border rounded-xl px-4 py-3 text-center text-2xl font-bold text-foreground"
                style={{ letterSpacing: 8 }}
              />
              <Pressable disabled={stopLoading || otpInput.length < 4} onPress={() => doAction(() => confirmOtp(stop.id, driver.tankerId, otpInput))} className="bg-success rounded-xl py-3 items-center">
                {stopLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Verify OTP</Text>}
              </Pressable>

              <View className="flex-row gap-2">
                <Pressable
                  disabled={stopLoading}
                  onPress={() => {
                    Alert.prompt("Skip reason", "Why are you skipping?", (r) => {
                      if (r?.trim()) doAction(() => skipStop(stop.id, driver.tankerId, r.trim()));
                    });
                  }}
                  className="flex-1 border border-border rounded-xl py-3 items-center"
                >
                  <Text className="text-muted-foreground font-medium">Skip</Text>
                </Pressable>

                <Pressable
                  disabled={stopLoading}
                  onPress={() => {
                    Alert.prompt("Failure reason", "Why did delivery fail?", (r) => {
                      if (r?.trim()) doAction(() => failStop(stop.id, driver.tankerId, r.trim()));
                    });
                  }}
                  className="flex-1 border border-red-200/40 rounded-xl py-3 items-center"
                >
                  <Text className="text-red-600 font-medium">Fail</Text>
                </Pressable>
              </View>
            </View>
          )}

          {stopStatus === "awaiting_otp" && stop.otp_verified && (
            <Pressable disabled={stopLoading} onPress={() => doAction(() => completeStop(stop.id, driver.tankerId))} className="bg-success rounded-xl py-3 items-center">
              {stopLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Complete Delivery</Text>}
            </Pressable>
          )}
        </View>
      )}

      <Pressable onPress={onRefresh} className="flex-row items-center justify-center gap-2 border border-border rounded-xl py-3">
        <RefreshCw color={theme.mutedForeground} size={16} />
        <Text className="text-muted-foreground font-medium">Refresh</Text>
      </Pressable>

      {allDone && (
        <Pressable onPress={onCompleteJob} disabled={actionLoading} className="bg-success rounded-xl py-4 items-center">
          {actionLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Complete Job</Text>}
        </Pressable>
      )}
    </View>
  );
}
