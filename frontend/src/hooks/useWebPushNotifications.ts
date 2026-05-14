import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  PushUserType,
  subscribeToPushOnBackend,
  unsubscribeFromPushOnBackend,
} from "@/lib/notificationsApi";

const VAPID_PUBLIC_KEY = "BHp5ivLTnIoScsWdpNUg29jYlF52XtM8BCwdNl_pNcyRChcs5Oc55f_H4rUas4NA-S89uUIJ5yflBrCIueVT-fc";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function useWebPushNotifications(params: {
  userType: PushUserType;
  userId?: number | null;
}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    setIsSupported(isPushSupported());

    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    async function checkExistingSubscription() {
      if (!isPushSupported()) return;

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();

      setIsSubscribed(Boolean(existing));
    }

    void checkExistingSubscription();
  }, []);

  const enableWebPush = useCallback(async () => {
    if (!isPushSupported()) {
      toast.error("Push notifications are not supported on this browser.");
      return;
    }

    if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.includes("PASTE_YOUR")) {
      toast.error("VAPID public key is not configured yet.");
      return;
    }

    const notificationPermission = await Notification.requestPermission();
    setPermission(notificationPermission);

    if (notificationPermission !== "granted") {
      toast.error("Notification permission was not granted.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await subscribeToPushOnBackend({
      userType: params.userType,
      userId: params.userId ?? null,
      subscription,
    });

    setIsSubscribed(true);
    toast.success("Push notifications enabled.");
  }, [params.userId, params.userType]);

  const disableWebPush = useCallback(async () => {
    if (!isPushSupported()) return;

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await unsubscribeFromPushOnBackend(subscription);
      await subscription.unsubscribe();
    }

    setIsSubscribed(false);
    toast.message("Push notifications disabled.");
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    enableWebPush,
    disableWebPush,
  };
}