import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { CheckCircle, Navigation, Phone, RefreshCw, User } from "lucide-react-native";
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
  verifySite,
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
  driverLat?: number | null;
  driverLon?: number | null;
  stopLat?: number | null;
  stopLon?: number | null;
};

export function DriverDeliveringStep({
  driver,
  currentStop,
  onRefresh,
  onCompleteJob,
  actionLoading,
  setError,
  onReportIncident,
  driverLat,
  driverLon,
  stopLat,
  stopLon,
}: Props) {
  const stop = currentStop?.current_stop ?? currentStop?.stop;
  const summary = currentStop?.stops_summary ?? [];
  const deliveredCount = summary.filter((s: any) => s.delivery_status === "delivered").length;
  const totalCount = summary.length;
  const allDone = totalCount > 0 && deliveredCount === totalCount;
  const stopStatus: string = stop?.delivery_status ?? "";

  const { theme } = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const [otpInput, setOtpInput] = useState("");
  const [meterStart, setMeterStart] = useState("");
  const [meterEnd, setMeterEnd] = useState("");
  const [stopLoading, setStopLoading] = useState(false);
  const [siteVerificationDone, setSiteVerificationDone] = useState(false);
  const [siteTankHeight, setSiteTankHeight] = useState("");
  const [siteHoseDistance, setSiteHoseDistance] = useState("");
  const [siteRoadDifficulty, setSiteRoadDifficulty] = useState<number | null>(null);

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
            style={{ backgroundColor: theme.successSoft }}
          >
            <Navigation color={theme.success} size={36} />
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
      {driverLat != null && driverLon != null && (
        <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: theme.border }}>
          <MapView
            ref={mapRef}
            style={{ height: 200 }}
            onLayout={() => {
              const coords = [
                { latitude: driverLat!, longitude: driverLon! },
                ...(stopLat != null && stopLon != null
                  ? [{ latitude: stopLat, longitude: stopLon }]
                  : []),
              ];
              mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                animated: false,
              });
            }}
          >
            <Marker
              coordinate={{ latitude: driverLat!, longitude: driverLon! }}
              title="Your tanker"
              pinColor="#2563eb"
            />
            {stopLat != null && stopLon != null && (
              <Marker
                coordinate={{ latitude: stopLat, longitude: stopLon }}
                title={stop?.customer?.name ?? "Delivery stop"}
                pinColor="#16a34a"
              />
            )}
          </MapView>
        </View>
      )}

      {totalCount > 0 && (
        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View className="flex-row justify-between mb-2">
            <Text className="font-semibold" style={{ color: theme.foreground }}>Progress</Text>
            <Text className="font-bold" style={{ color: theme.success }}>{deliveredCount}/{totalCount}</Text>
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
            borderColor: s.delivery_id === stop?.id ? theme.success : theme.border,
            opacity: s.delivery_status === "delivered" ? 0.5 : 1,
          }}
        >
          <View className="flex-row items-center gap-2">
            <View
              className="w-6 h-6 rounded-full items-center justify-center"
              style={{ backgroundColor: theme.success }}
            >
              <Text className="text-xs font-bold" style={{ color: theme.primaryForeground }}>
                {s.delivery_status === "delivered" ? "✓" : idx + 1}
              </Text>
            </View>
            <Text className="font-medium flex-1" style={{ color: theme.foreground }}>
              {s.customer_name ?? `Stop ${idx + 1}`}
            </Text>
            <Text className="text-xs capitalize" style={{ color: theme.mutedForeground }}>
              {s.delivery_status?.replace(/_/g, " ")}
            </Text>
          </View>
        </View>
      ))}

      {stop && !allDone && (
        <View
          className="rounded-2xl p-5 gap-3"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.success + "66" }}
        >
          {/* Customer header */}
          <View className="flex-row items-center gap-2">
            <User color={theme.success} size={15} />
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
              style={{ backgroundColor: theme.success }}
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

          {stopStatus === "awaiting_otp" && stop.otp_verified && !siteVerificationDone && (
            <View className="gap-3">
              <View
                className="flex-row items-center gap-2 rounded-xl px-3 py-2"
                style={{ backgroundColor: theme.successSoft }}
              >
                <CheckCircle color={theme.success} size={14} />
                <Text className="text-sm font-semibold" style={{ color: theme.success }}>OTP verified</Text>
              </View>

              <Text className="text-sm font-semibold" style={{ color: theme.foreground }}>
                Verify site conditions
              </Text>
              <Text className="text-xs" style={{ color: theme.mutedForeground }}>
                These are optional. Accurate observations improve future routing.
              </Text>

              <View className="gap-1">
                <Text className="text-xs" style={{ color: theme.mutedForeground }}>Tank height (m)</Text>
                <TextInput
                  value={siteTankHeight}
                  onChangeText={setSiteTankHeight}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 2.5"
                  placeholderTextColor={theme.mutedForeground}
                  className="rounded-xl px-4 py-3"
                  style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.foreground }}
                />
              </View>

              <View className="gap-1">
                <Text className="text-xs" style={{ color: theme.mutedForeground }}>Hose distance (m)</Text>
                <TextInput
                  value={siteHoseDistance}
                  onChangeText={setSiteHoseDistance}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 15"
                  placeholderTextColor={theme.mutedForeground}
                  className="rounded-xl px-4 py-3"
                  style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.foreground }}
                />
              </View>

              <View className="gap-1">
                <Text className="text-xs" style={{ color: theme.mutedForeground }}>Road difficulty</Text>
                <View className="flex-row gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setSiteRoadDifficulty(n)}
                      className="flex-1 py-2 rounded-lg items-center"
                      style={{
                        backgroundColor: siteRoadDifficulty === n ? theme.primary : theme.background,
                        borderWidth: 1,
                        borderColor: siteRoadDifficulty === n ? theme.primary : theme.border,
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: siteRoadDifficulty === n ? theme.primaryForeground : theme.mutedForeground }}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  disabled={stopLoading}
                  onPress={() => setSiteVerificationDone(true)}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ borderWidth: 1, borderColor: theme.border }}
                >
                  <Text className="font-medium" style={{ color: theme.mutedForeground }}>Skip</Text>
                </Pressable>
                <Pressable
                  disabled={stopLoading}
                  onPress={async () => {
                    const payload: { tank_height_m?: number; hose_distance_m?: number; road_difficulty?: number } = {};
                    if (siteTankHeight) payload.tank_height_m = parseFloat(siteTankHeight);
                    if (siteHoseDistance) payload.hose_distance_m = parseFloat(siteHoseDistance);
                    if (siteRoadDifficulty) payload.road_difficulty = siteRoadDifficulty;
                    setStopLoading(true);
                    setError(null);
                    try {
                      if (Object.keys(payload).length > 0) {
                        await verifySite(stop.delivery_id, driver.tankerId, payload);
                      }
                      setSiteVerificationDone(true);
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setStopLoading(false);
                    }
                  }}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ backgroundColor: theme.primary }}
                >
                  {stopLoading ? (
                    <ActivityIndicator color={theme.primaryForeground} />
                  ) : (
                    <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Submit</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {stopStatus === "awaiting_otp" && stop.otp_verified && siteVerificationDone && (
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
