import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { Navigation, Phone, RefreshCw, User } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SiteCard } from "@/components/driver/SiteCard";
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
  onReportIncident?: () => void;
};

export function DriverDeliveringStep({
  driver,
  currentStop,
  onRefresh,
  onCompleteJob,
  actionLoading,
  setError,
  onReportIncident,
}: Props) {
  const stop = currentStop?.current_stop ?? currentStop?.stop;
  const summary = currentStop?.stops_summary ?? [];
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
        <View
          className="rounded-2xl p-8 items-center gap-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: theme.primarySoft }}
          >
            <Navigation color={theme.primary} size={36} />
          </View>
          <View className="items-center gap-1">
            <Text className="font-bold text-xl" style={{ color: theme.foreground }}>No stops yet</Text>
            <Text className="text-center text-sm leading-5" style={{ color: theme.mutedForeground }}>
              Stops will appear here once the job is dispatched. Refresh to check for updates.
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onRefresh}
          className="flex-row items-center justify-center gap-2 rounded-xl py-3"
          style={{ borderWidth: 1, borderColor: theme.border }}
        >
          <RefreshCw color={theme.mutedForeground} size={16} />
          <Text className="font-medium" style={{ color: theme.mutedForeground }}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {totalCount > 0 && (
        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View className="flex-row justify-between mb-2">
            <Text className="font-semibold" style={{ color: theme.foreground }}>Progress</Text>
            <Text className="font-bold" style={{ color: theme.primary }}>{deliveredCount}/{totalCount}</Text>
          </View>
          <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
            <View
              className="h-full"
              style={{
                backgroundColor: theme.success,
                width: `${totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0}%`,
              }}
            />
          </View>
        </View>
      )}

      {summary.map((s: any, idx: number) => (
        <View
          key={s.delivery_id ?? idx}
          className="rounded-xl p-3"
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: s.delivery_id === stop?.id ? theme.primary : theme.border,
            opacity: s.status === "delivered" ? 0.5 : 1,
          }}
        >
          <View className="flex-row items-center gap-2">
            <View
              className="w-6 h-6 rounded-full items-center justify-center"
              style={{ backgroundColor: s.status === "delivered" ? theme.success : theme.primary }}
            >
              <Text className="text-xs font-bold" style={{ color: theme.primaryForeground }}>
                {s.status === "delivered" ? "✓" : idx + 1}
              </Text>
            </View>
            <Text className="font-medium flex-1" style={{ color: theme.foreground }}>
              {s.customer_name ?? `Stop ${idx + 1}`}
            </Text>
            <Text className="text-xs capitalize" style={{ color: theme.mutedForeground }}>
              {s.status?.replace(/_/g, " ")}
            </Text>
          </View>
        </View>
      ))}

      {stop && !allDone && (
        <View
          className="rounded-2xl p-5 gap-3"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.primary + "66" }}
        >
          {/* Customer header */}
          <View className="flex-row items-center gap-2">
            <User color={theme.primary} size={15} />
            <Text className="font-semibold flex-1" style={{ color: theme.foreground }}>
              {stop.customer?.name ?? "—"}
            </Text>
            {stop.customer?.phone && (
              <View className="flex-row items-center gap-1">
                <Phone color={theme.mutedForeground} size={13} />
                <Text className="text-xs" style={{ color: theme.mutedForeground }}>{stop.customer.phone}</Text>
              </View>
            )}
          </View>

          {/* Site details */}
          <SiteCard site={stop.customer?.site} volume={stop.planned_liters} />

          <Text className="text-xs capitalize" style={{ color: theme.mutedForeground }}>
            Status: {stopStatus.replace(/_/g, " ")}
          </Text>

          {(stopStatus === "en_route" || stopStatus === "pending") && (
            <Pressable
              disabled={stopLoading}
              onPress={() => doAction(() => arriveAtStop(stop.delivery_id, driver.tankerId))}
              className="rounded-xl py-3 items-center"
              style={{ backgroundColor: theme.primary }}
            >
              {stopLoading ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <Text className="font-semibold" style={{ color: theme.primaryForeground }}>I've Arrived</Text>
              )}
            </Pressable>
          )}

          {stopStatus === "arrived" && (
            <View className="gap-2">
              <Text className="text-sm" style={{ color: theme.mutedForeground }}>Meter start reading</Text>
              <TextInput
                value={meterStart}
                onChangeText={setMeterStart}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.mutedForeground}
                className="rounded-xl px-4 py-3"
                style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.foreground }}
              />
              <Pressable
                disabled={stopLoading || !meterStart}
                onPress={() => doAction(() => startMeasurement(stop.delivery_id, driver.tankerId, parseFloat(meterStart)))}
                className="rounded-xl py-3 items-center"
                style={{ backgroundColor: theme.primary }}
              >
                {stopLoading ? (
                  <ActivityIndicator color={theme.primaryForeground} />
                ) : (
                  <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Start Measurement</Text>
                )}
              </Pressable>
              <View className="flex-row gap-2">
                <Pressable
                  disabled={stopLoading}
                  onPress={() => {
                    Alert.prompt("Skip reason", "Why are you skipping?", (r) => {
                      if (r?.trim()) doAction(() => skipStop(stop.delivery_id, driver.tankerId, r.trim()));
                    });
                  }}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ borderWidth: 1, borderColor: theme.border }}
                >
                  <Text className="font-medium" style={{ color: theme.mutedForeground }}>Skip</Text>
                </Pressable>
                <Pressable
                  disabled={stopLoading}
                  onPress={() => {
                    Alert.prompt("Failure reason", "Why did delivery fail?", (r) => {
                      if (r?.trim()) doAction(() => failStop(stop.delivery_id, driver.tankerId, r.trim()));
                    });
                  }}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ borderWidth: 1, borderColor: theme.destructive + "66" }}
                >
                  <Text className="font-medium" style={{ color: theme.destructive }}>Fail</Text>
                </Pressable>
              </View>
            </View>
          )}

          {stopStatus === "measuring" && (
            <View className="gap-2">
              <Text className="text-sm" style={{ color: theme.mutedForeground }}>Meter end reading</Text>
              <TextInput
                value={meterEnd}
                onChangeText={setMeterEnd}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.mutedForeground}
                className="rounded-xl px-4 py-3"
                style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.foreground }}
              />
              <Pressable
                disabled={stopLoading || !meterEnd}
                onPress={() => doAction(() => finishMeasurement(stop.delivery_id, driver.tankerId, parseFloat(meterEnd)))}
                className="rounded-xl py-3 items-center"
                style={{ backgroundColor: theme.primary }}
              >
                {stopLoading ? (
                  <ActivityIndicator color={theme.primaryForeground} />
                ) : (
                  <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Finish Measurement</Text>
                )}
              </Pressable>
              <View className="flex-row gap-2">
                <Pressable
                  disabled={stopLoading}
                  onPress={() => {
                    Alert.prompt("Skip reason", "Why are you skipping?", (r) => {
                      if (r?.trim()) doAction(() => skipStop(stop.delivery_id, driver.tankerId, r.trim()));
                    });
                  }}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ borderWidth: 1, borderColor: theme.border }}
                >
                  <Text className="font-medium" style={{ color: theme.mutedForeground }}>Skip</Text>
                </Pressable>
                <Pressable
                  disabled={stopLoading}
                  onPress={() => {
                    Alert.prompt("Failure reason", "Why did delivery fail?", (r) => {
                      if (r?.trim()) doAction(() => failStop(stop.delivery_id, driver.tankerId, r.trim()));
                    });
                  }}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ borderWidth: 1, borderColor: theme.destructive + "66" }}
                >
                  <Text className="font-medium" style={{ color: theme.destructive }}>Fail</Text>
                </Pressable>
              </View>
            </View>
          )}

          {stopStatus === "awaiting_otp" && !stop.otp_verified && (
            <View className="gap-2">
              <Text className="text-sm" style={{ color: theme.mutedForeground }}>Customer OTP</Text>
              <TextInput
                value={otpInput}
                onChangeText={setOtpInput}
                keyboardType="number-pad"
                placeholder="0000"
                placeholderTextColor={theme.mutedForeground}
                maxLength={6}
                className="rounded-xl px-4 py-3 text-center text-2xl font-bold"
                style={{
                  backgroundColor: theme.background,
                  borderWidth: 1,
                  borderColor: theme.border,
                  color: theme.foreground,
                  letterSpacing: 8,
                }}
              />
              <Pressable
                disabled={stopLoading || otpInput.length < 4}
                onPress={() => doAction(() => confirmOtp(stop.delivery_id, driver.tankerId, otpInput))}
                className="rounded-xl py-3 items-center"
                style={{ backgroundColor: theme.success }}
              >
                {stopLoading ? (
                  <ActivityIndicator color={theme.primaryForeground} />
                ) : (
                  <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Verify OTP</Text>
                )}
              </Pressable>

              <View className="flex-row gap-2">
                <Pressable
                  disabled={stopLoading}
                  onPress={() => {
                    Alert.prompt("Skip reason", "Why are you skipping?", (r) => {
                      if (r?.trim()) doAction(() => skipStop(stop.delivery_id, driver.tankerId, r.trim()));
                    });
                  }}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ borderWidth: 1, borderColor: theme.border }}
                >
                  <Text className="font-medium" style={{ color: theme.mutedForeground }}>Skip</Text>
                </Pressable>

                <Pressable
                  disabled={stopLoading}
                  onPress={() => {
                    Alert.prompt("Failure reason", "Why did delivery fail?", (r) => {
                      if (r?.trim()) doAction(() => failStop(stop.delivery_id, driver.tankerId, r.trim()));
                    });
                  }}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ borderWidth: 1, borderColor: theme.destructive + "66" }}
                >
                  <Text className="font-medium" style={{ color: theme.destructive }}>Fail</Text>
                </Pressable>
              </View>
            </View>
          )}

          {stopStatus === "awaiting_otp" && stop.otp_verified && (
            <Pressable
              disabled={stopLoading}
              onPress={() => doAction(() => completeStop(stop.delivery_id, driver.tankerId))}
              className="rounded-xl py-3 items-center"
              style={{ backgroundColor: theme.success }}
            >
              {stopLoading ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Complete Delivery</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      <Pressable
        onPress={onRefresh}
        className="flex-row items-center justify-center gap-2 rounded-xl py-3"
        style={{ borderWidth: 1, borderColor: theme.border }}
      >
        <RefreshCw color={theme.mutedForeground} size={16} />
        <Text className="font-medium" style={{ color: theme.mutedForeground }}>Refresh</Text>
      </Pressable>

      {allDone && (
        <Pressable
          onPress={onCompleteJob}
          disabled={actionLoading}
          className="rounded-xl py-4 items-center"
          style={{ backgroundColor: theme.success }}
        >
          {actionLoading ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Complete Job</Text>
          )}
        </Pressable>
      )}

      {onReportIncident && (
        <Pressable
          onPress={onReportIncident}
          className="items-center py-3"
        >
          <Text className="text-xs" style={{ color: theme.destructive }}>
            Report an incident
          </Text>
        </Pressable>
      )}
    </View>
  );
}
