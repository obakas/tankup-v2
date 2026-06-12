import { useCallback, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { updateTankerLocation } from "@/lib/driverApi";
import { useAppStatePause } from "@/hooks/useAppStatePause";
import { LOCATION_TASK_NAME } from "@/tasks/locationTask";

const INTERVAL_MS = 10_000;

interface UseLocationHeartbeatOptions {
  tankerId: number | null;
  enabled: boolean;
  onLocationUpdate?: (latitude: number, longitude: number) => void;
}

export function useLocationHeartbeat({
  tankerId,
  enabled,
  onLocationUpdate,
}: UseLocationHeartbeatOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSendingRef = useRef(false);
  // searchRef pattern: mirror volatile params to refs so interval closure reads fresh values
  const tankerIdRef = useRef(tankerId);
  const enabledRef = useRef(enabled);
  const onLocationUpdateRef = useRef(onLocationUpdate);
  tankerIdRef.current = tankerId;
  enabledRef.current = enabled;
  onLocationUpdateRef.current = onLocationUpdate;

  const sendLocation = useCallback(async () => {
    if (!enabledRef.current || !tankerIdRef.current || isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      const { status: existing } = await Location.getForegroundPermissionsAsync();
      const status = existing === "granted"
        ? existing
        : (await Location.requestForegroundPermissionsAsync()).status;
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      await updateTankerLocation(tankerIdRef.current, latitude, longitude);
      onLocationUpdateRef.current?.(latitude, longitude);
    } catch {
      // Silent — heartbeat failures must not disturb driver UX
    } finally {
      isSendingRef.current = false;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    if (!enabledRef.current || !tankerIdRef.current) return;
    void sendLocation();
    intervalRef.current = setInterval(() => void sendLocation(), INTERVAL_MS);
  }, [sendLocation, stopHeartbeat]);

  const stopBackgroundTask = useCallback(async () => {
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      // ignore — task may not have started yet
    }
  }, []);

  const startBackgroundTask = useCallback(async () => {
    if (!enabledRef.current || !tankerIdRef.current) return;
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== "granted") return;
      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!running) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 10,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "TankUp",
            notificationBody: "Tracking your location for delivery",
            notificationColor: "#0ea5e9",
          },
        });
      }
    } catch {
      // Silent — background permission denied or task failed to start
    }
  }, []);

  useEffect(() => {
    if (enabled && tankerId) {
      startHeartbeat();
    } else {
      stopHeartbeat();
      void stopBackgroundTask();
    }
    return () => {
      stopHeartbeat();
      void stopBackgroundTask();
    };
  }, [enabled, tankerId, startHeartbeat, stopHeartbeat, stopBackgroundTask]);

  useAppStatePause(
    () => { stopHeartbeat(); void startBackgroundTask(); },
    () => { void stopBackgroundTask(); startHeartbeat(); },
  );
}
