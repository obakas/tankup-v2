import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "water_tanker_client_alerts_enabled";

type AlertInput = {
  mode: "batch" | "priority";
  batchStatus?: string | null;
  deliveryStatus?: string | null;
  requestStatus?: string | null;
  tankerStatus?: string | null;
};

function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function buildAlert(input: AlertInput) {
  const status =
    input.deliveryStatus ||
    input.tankerStatus ||
    input.requestStatus ||
    input.batchStatus;

  switch (status) {
    case "assigned":
      return ["🚚 Tanker Assigned", "A tanker has been assigned to your order."];
    case "loading":
      return ["💧 Tanker Loading", "Your tanker is loading water."];
    case "delivering":
    case "en_route":
      return ["🛣️ Tanker En Route", "Your water is on the way."];
    case "arrived":
      return ["📍 Tanker Arrived", "Your tanker has arrived."];
    case "measuring":
      return ["📏 Measurement Started", "Water measurement has started."];
    case "awaiting_otp":
      return ["🔐 OTP Required", "Please provide your OTP to complete delivery."];
    case "delivered":
    case "completed":
      return ["✅ Delivery Completed", "Your water delivery is complete."];
    case "failed":
      return ["⚠️ Delivery Failed", "There was a problem with this delivery."];
    case "expired":
      return ["⏰ Batch Expired", "Your batch expired. Please check refund status."];
    default:
      return null;
  }
}

export function useClientDeliveryAlerts(input: AlertInput) {
  const [alertsEnabled, setAlertsEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(() => {
      if (!supportsNotifications()) return "denied";
      return window.Notification.permission;
    });

  const audioContextRef = useRef<AudioContext | null>(null);
  const lastAlertKeyRef = useRef<string | null>(null);

  const playBeep = useCallback(
    (force = false) => {
      if (!force && !alertsEnabled) return;
      if (typeof window === "undefined") return;

      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        const audioContext =
          audioContextRef.current ?? new AudioContextClass();

        audioContextRef.current = audioContext;
        void audioContext.resume();

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(920, audioContext.currentTime + 0.18);

        gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.25,
          audioContext.currentTime + 0.03
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          audioContext.currentTime + 0.5
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.52);
      } catch (error) {
        console.warn("Could not play client alert sound", error);
      }
    },
    [alertsEnabled]
  );

  const enableAlerts = useCallback(async () => {
    setAlertsEnabled(true);
    window.localStorage.setItem(STORAGE_KEY, "true");

    playBeep(true);

    if (supportsNotifications() && window.Notification.permission === "default") {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
    }

    if (supportsNotifications()) {
      setNotificationPermission(window.Notification.permission);
    }

    toast.success("Delivery alerts enabled.");
  }, [playBeep]);

  const disableAlerts = useCallback(() => {
    setAlertsEnabled(false);
    window.localStorage.setItem(STORAGE_KEY, "false");
    toast.message("Delivery alerts disabled.");
  }, []);

  useEffect(() => {
    if (!alertsEnabled) return;

    const alert = buildAlert(input);
    if (!alert) return;

    const key = [
      input.mode,
      input.batchStatus,
      input.deliveryStatus,
      input.requestStatus,
      input.tankerStatus,
    ].join("-");

    if (lastAlertKeyRef.current === key) return;
    lastAlertKeyRef.current = key;

    const [title, body] = alert;

    playBeep();
    toast.message(title, { description: body });

    if (supportsNotifications() && window.Notification.permission === "granted") {
      const notification = new window.Notification(title, {
        body,
        tag: key,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, [alertsEnabled, input, playBeep]);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  return {
    alertsEnabled,
    notificationPermission,
    enableAlerts,
    disableAlerts,
  };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}