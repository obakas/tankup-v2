import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { IncomingDriverOffer } from "@/lib/driverApi";

const STORAGE_KEY = "water_tanker_driver_job_alerts_enabled";

function getOfferKey(offer: IncomingDriverOffer | null) {
  if (!offer) return null;
  return `${offer.type}-${offer.id}`;
}

function getOfferTitle(offer: IncomingDriverOffer) {
  return offer.type === "priority"
    ? "🚨 New Priority Tanker Job"
    : "🚨 New Batch Tanker Job";
}

function getOfferBody(offer: IncomingDriverOffer) {
  if (offer.type === "priority") {
    return `${(offer.volume_liters ?? 0).toLocaleString()}L delivery. Accept before it expires.`;
  }

  return `${(offer.total_volume ?? 0).toLocaleString()}L total • ${
    offer.member_count ?? 0
  } stop(s). Accept before it expires.`;
}

function browserSupportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function useDriverOfferAlarm(offer: IncomingDriverOffer | null) {
  const offerKey = useMemo(() => getOfferKey(offer), [offer]);

  const [alertsEnabled, setAlertsEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(() => {
      if (!browserSupportsNotifications()) return "denied";
      return window.Notification.permission;
    });

  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);
  const lastNotifiedOfferKeyRef = useRef<string | null>(null);

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

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(
          660,
          audioContext.currentTime + 0.16
        );
        oscillator.frequency.setValueAtTime(
          990,
          audioContext.currentTime + 0.32
        );

        gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.35,
          audioContext.currentTime + 0.03
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          audioContext.currentTime + 0.58
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.62);
      } catch (error) {
        console.warn("Could not play driver offer alarm", error);
      }
    },
    [alertsEnabled]
  );

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current !== null) {
      window.clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, []);

  const startAlarm = useCallback(() => {
    if (!alertsEnabled || alarmIntervalRef.current !== null) return;

    playBeep();

    alarmIntervalRef.current = window.setInterval(() => {
      playBeep();
    }, 1800);
  }, [alertsEnabled, playBeep]);

  const enableAlerts = useCallback(async () => {
    setAlertsEnabled(true);
    window.localStorage.setItem(STORAGE_KEY, "true");

    playBeep(true);

    if (
      browserSupportsNotifications() &&
      window.Notification.permission === "default"
    ) {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        toast.success("Loud job alerts and browser notifications are enabled.");
      } else {
        toast.message(
          "Sound alert enabled. Browser notifications were not allowed."
        );
      }

      return;
    }

    if (browserSupportsNotifications()) {
      setNotificationPermission(window.Notification.permission);
    }

    toast.success("Loud job alerts are enabled.");
  }, [playBeep]);

  const disableAlerts = useCallback(() => {
    stopAlarm();
    setAlertsEnabled(false);
    window.localStorage.setItem(STORAGE_KEY, "false");
    toast.message("Loud job alerts disabled.");
  }, [stopAlarm]);

  useEffect(() => {
    if (!offer || !offerKey) {
      stopAlarm();
      return;
    }

    startAlarm();

    if (
      browserSupportsNotifications() &&
      window.Notification.permission === "granted" &&
      lastNotifiedOfferKeyRef.current !== offerKey
    ) {
      lastNotifiedOfferKeyRef.current = offerKey;

      const notification = new window.Notification(getOfferTitle(offer), {
        body: getOfferBody(offer),
        tag: offerKey,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, [offer, offerKey, startAlarm, stopAlarm]);

  useEffect(() => {
    return () => {
      stopAlarm();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [stopAlarm]);

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