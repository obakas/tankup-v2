import { useCallback, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { updateTankerLocation } from "@/lib/driverApi";
import { useAppStatePause } from "@/hooks/useAppStatePause";

const INTERVAL_MS = 4000;

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
      const { status } = await Location.requestForegroundPermissionsAsync();
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

  useEffect(() => {
    if (enabled && tankerId) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
    return stopHeartbeat;
  }, [enabled, tankerId, startHeartbeat, stopHeartbeat]);

  useAppStatePause(stopHeartbeat, startHeartbeat);
}
