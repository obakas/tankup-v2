import { Alert, Platform, Vibration } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, { AndroidForegroundServiceType, AndroidImportance, EventType } from "react-native-notify-kit";

import { acceptOffer, rejectOffer } from "@/lib/api";

// Must match RING_CHANNEL_ID / RING_SOUND in backend/app/services/push_service.py
// and the sound file name bundled via mobile/app.json's expo-notifications "sounds" config.
export const RING_CHANNEL_ID = "job_offer_ring";
const RING_SOUND = "ring_placeholder";

// Must match ARRIVAL_RING_CHANNEL_ID / ARRIVAL_RING_SOUND in push_service.py.
// Separate channel id from the job-offer one — Android bakes sound/importance
// into a channel permanently once created on a device, so the two ring types
// can't share a channel even though they reuse the same bundled sound asset.
export const ARRIVAL_RING_CHANNEL_ID = "delivery_arrival_ring";
const ARRIVAL_RING_SOUND = "ring_placeholder";

export async function ensureRingChannels() {
  await notifee.createChannel({
    id: RING_CHANNEL_ID,
    name: "Job Offer Ring",
    importance: AndroidImportance.HIGH,
    sound: RING_SOUND,
  });
  await notifee.createChannel({
    id: ARRIVAL_RING_CHANNEL_ID,
    name: "Delivery Arrival Ring",
    importance: AndroidImportance.HIGH,
    sound: ARRIVAL_RING_SOUND,
  });
}

/**
 * `notifee.registerForegroundService` requires a runner or `asForegroundService`
 * notifications silently fail to display. The never-resolving promise is the
 * standard pattern — the service is stopped externally via
 * `stopRingNotification()`'s `notifee.stopForegroundService()` call.
 */
export function registerRingForegroundService() {
  notifee.registerForegroundService(() => new Promise(() => {}));
}

/**
 * `notifee.handleFcmMessage()` reconstructs a notification from `notifee_options`
 * via a restricted allowlist (channelId/pressAction/actions/smallIcon/largeIcon/
 * color/style only — see `react-native-notify-kit/dist/fcm/reconstructNotification.js`)
 * that silently drops `asForegroundService`, `fullScreenAction`, `sound`,
 * `loopSound`, `category`, and `timeoutAfter` — exactly the fields that make this
 * a call-style ring rather than a plain heads-up notification. Those richer
 * fields are only honored by `displayNotification()` called directly, so the
 * payload is parsed here and passed straight through instead of relying on the
 * FCM auto-reconstruction path.
 */
export async function displayRingNotification(remoteMessage: { data?: Record<string, string> }): Promise<void> {
  const raw = remoteMessage?.data?.notifee_options;
  if (typeof raw !== "string") return;

  let parsed: { title?: string; body?: string; android?: Record<string, unknown> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  const android = parsed.android ?? {};
  const offerId = remoteMessage?.data?.offer_id;
  const deliveryId = remoteMessage?.data?.delivery_id;
  const asForegroundService = android.asForegroundService === true;

  await notifee.displayNotification({
    // Matches the id stopRingNotification()/stopArrivalRingNotification() cancel
    // by — without this it defaults to the FCM messageId, so cancel silently no-ops.
    id: offerId != null ? `offer-${offerId}` : deliveryId != null ? `arrival-${deliveryId}` : undefined,
    title: parsed.title ?? "",
    body: parsed.body ?? "",
    data: remoteMessage?.data,
    android: {
      channelId: (android.channelId as string) ?? RING_CHANNEL_ID,
      category: android.category as any,
      asForegroundService,
      foregroundServiceTypes: asForegroundService
        ? [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK]
        : undefined,
      fullScreenAction: android.fullScreenAction as any,
      pressAction: (android.pressAction as any) ?? { id: "default" },
      sound: android.sound as string,
      loopSound: android.loopSound as boolean,
      actions: android.actions as any,
      timeoutAfter: android.timeoutAfter as number,
    },
  });
}

export async function stopRingNotification(offerId?: number | string | null) {
  try {
    await notifee.stopForegroundService();
  } catch {
    // no-op: nothing was running
  }
  if (offerId != null) {
    try {
      await notifee.cancelNotification(`offer-${offerId}`);
    } catch {
      // no-op: already cancelled/expired
    }
  }
}

export async function stopArrivalRingNotification(deliveryId?: number | string | null) {
  try {
    await notifee.stopForegroundService();
  } catch {
    // no-op: nothing was running
  }
  if (deliveryId != null) {
    try {
      await notifee.cancelNotification(`arrival-${deliveryId}`);
    } catch {
      // no-op: already cancelled/expired
    }
  }
}

async function handleRingActionPress(event: {
  type: EventType;
  detail: { notification?: { id?: string; data?: Record<string, unknown> }; pressAction?: { id?: string } };
}) {
  const notification = event.detail.notification;
  const data = notification?.data;
  const actionId = event.detail.pressAction?.id;

  if (data?.type === "delivery_arrival") {
    // Unlike job offers (explicit Accept/Decline only), an arrival ring also
    // stops on a plain notification tap (opening the app) or a swipe-dismiss —
    // there's no "reject" concept for an arrival, just "I've seen it."
    const isStopTrigger =
      event.type === EventType.DISMISSED ||
      event.type === EventType.PRESS ||
      (event.type === EventType.ACTION_PRESS && actionId === "dismiss");
    if (!isStopTrigger) return;

    Vibration.cancel();
    const deliveryIdRaw = data?.delivery_id;
    await stopArrivalRingNotification(deliveryIdRaw != null ? Number(deliveryIdRaw) : undefined);
    if (notification?.id) {
      try {
        await notifee.cancelNotification(notification.id);
      } catch {
        // no-op
      }
    }
    return;
  }

  // Job-offer branch — only explicit Accept/Decline action presses matter.
  if (event.type !== EventType.ACTION_PRESS) return;
  const tankerIdRaw = data?.tanker_id;
  const tankerId = tankerIdRaw != null ? Number(tankerIdRaw) : NaN;

  if (!actionId || actionId === "default" || Number.isNaN(tankerId)) {
    return;
  }

  try {
    if (actionId === "accept") {
      await acceptOffer(tankerId);
    } else if (actionId === "decline") {
      await rejectOffer(tankerId);
    }
  } finally {
    Vibration.cancel();
    await stopRingNotification();
    if (notification?.id) {
      try {
        await notifee.cancelNotification(notification.id);
      } catch {
        // no-op
      }
    }
  }
}

const RING_EVENT_TYPES = [EventType.ACTION_PRESS, EventType.PRESS, EventType.DISMISSED];

/** Register once, in mobile/index.js before the app registers. */
export function registerRingBackgroundHandler() {
  notifee.onBackgroundEvent(async (event) => {
    if (!RING_EVENT_TYPES.includes(event.type)) return;
    await handleRingActionPress(event);
  });
}

/** Call once from a top-level component (app/_layout.tsx); returns an unsubscribe fn. */
export function registerRingForegroundHandler() {
  return notifee.onForegroundEvent((event) => {
    if (!RING_EVENT_TYPES.includes(event.type)) return;
    void handleRingActionPress(event);
  });
}

const RING_BG_DEBUG_KEY = "ring_bg_debug_v1";

/**
 * Breadcrumb for the FCM background handler (mobile/index.js), which runs
 * outside any screen and can't show UI directly. Records whether it ran and
 * whether notifee.handleFcmMessage succeeded, so the next app open can
 * surface it — this is the only way to diagnose a background handler that
 * silently never fires without a device-connected debugger.
 */
export async function recordRingBackgroundDebug(info: Record<string, unknown>): Promise<void> {
  try {
    await AsyncStorage.setItem(RING_BG_DEBUG_KEY, JSON.stringify({ ...info, recordedAt: new Date().toISOString() }));
  } catch {
    // no-op
  }
}

export async function consumeRingBackgroundDebug(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(RING_BG_DEBUG_KEY);
    if (raw) await AsyncStorage.removeItem(RING_BG_DEBUG_KEY);
    return raw;
  } catch {
    return null;
  }
}

const RING_PERMISSIONS_PROMPTED_KEY = "ring_permissions_prompted_v1";
// Full-screen-intent became a runtime-gated permission starting Android 14 (API 34).
// Below that, USE_FULL_SCREEN_INTENT in the manifest is enough and no prompt is needed.
const FULL_SCREEN_INTENT_MIN_SDK = 34;

function confirmAlert(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Not now", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
}

/**
 * One-time-per-install nudge (plus a live re-check for battery optimization on
 * every call) to grant the OS permissions the call-style ring depends on.
 * Without these, notifee.handleFcmMessage() still runs but the OS silently
 * downgrades the ring to a normal, non-looping heads-up notification instead
 * of the full-screen call UI — the exact failure mode this exists to prevent.
 * Call once, right after push token registration succeeds (see useDriverFlow).
 */
export async function promptRingPermissionsOnce(): Promise<void> {
  if (Platform.OS !== "android") return;

  const alreadyPrompted = await AsyncStorage.getItem(RING_PERMISSIONS_PROMPTED_KEY);

  // notifee has no API to check whether full-screen-intent is already granted,
  // so this can only ever be a one-time nudge, not a self-resolving re-check.
  if (!alreadyPrompted && Number(Platform.Version) >= FULL_SCREEN_INTENT_MIN_SDK) {
    const shouldOpen = await confirmAlert(
      "Enable full-screen ringing",
      "So you never miss a job offer, allow TankUp to show a full-screen call-style alert — even when your phone is locked.",
      "Enable"
    );
    if (shouldOpen) {
      try {
        await notifee.openNotificationSettings();
      } catch {
        // no-op: nothing we can do if the settings screen won't open
      }
    }
  }

  try {
    // Live check (not gated on alreadyPrompted) — self-resolving, only nags
    // while the app is actually still battery-restricted.
    const isRestricted = await notifee.isBatteryOptimizationEnabled();
    if (isRestricted) {
      const shouldOpen = await confirmAlert(
        "Allow TankUp to run in the background",
        "Some phones stop apps running in the background to save power. Disable battery optimization for TankUp so job offer alerts always reach you.",
        "Allow"
      );
      if (shouldOpen) {
        try {
          await notifee.openBatteryOptimizationSettings();
        } catch {
          // no-op
        }
      }
    }

    if (!alreadyPrompted) {
      const powerManagerInfo = await notifee.getPowerManagerInfo();
      if (powerManagerInfo.activity) {
        const shouldOpen = await confirmAlert(
          "One more setting for reliable alerts",
          `${powerManagerInfo.manufacturer ?? "Your phone"} has its own battery manager. Allow TankUp to run in the background there too, so job offers always ring.`,
          "Open settings"
        );
        if (shouldOpen) {
          try {
            await notifee.openPowerManagerSettings();
          } catch {
            // no-op
          }
        }
      }
    }
  } catch {
    // Battery optimization / power manager APIs aren't available on this
    // device firmware — skip silently rather than blocking the driver flow.
  }

  if (!alreadyPrompted) {
    await AsyncStorage.setItem(RING_PERMISSIONS_PROMPTED_KEY, "1");
  }
}
