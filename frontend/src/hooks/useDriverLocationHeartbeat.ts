import { useEffect, useRef } from "react";
import { updateDriverLocation } from "../lib/driverApi";

type UseDriverLocationHeartbeatParams = {
    tankerId?: number | null;
    enabled?: boolean;
    intervalMs?: number;
};

export function useDriverLocationHeartbeat({
    tankerId,
    enabled = false,
    intervalMs = 8000,
}: UseDriverLocationHeartbeatParams) {
    const intervalRef = useRef<number | null>(null);
    const isSendingRef = useRef(false);

    useEffect(() => {
        if (!enabled || !tankerId || !navigator.geolocation) {
            return;
        }

        const sendLocation = () => {
            if (isSendingRef.current) return;

            isSendingRef.current = true;

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        await updateDriverLocation(tankerId, {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        });
                    } catch (error) {
                        console.error("Failed to update driver location:", error);
                    } finally {
                        isSendingRef.current = false;
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    isSendingRef.current = false;
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 5000,
                    timeout: 10000,
                }
            );
        };

        sendLocation();
        intervalRef.current = window.setInterval(sendLocation, intervalMs);

        return () => {
            if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
            }
        };
    }, [tankerId, enabled, intervalMs]);
}