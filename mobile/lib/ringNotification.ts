import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, { AndroidImportance, EventType } from "react-native-notify-kit";

import { acceptOffer, rejectOffer } from "@/lib/api";

// Must match RING_CHANNEL_ID / RING_SOUND in backend/app/services/push_service.py
// and the sound file name bundled via mobile/app.json's expo-notifications "sounds" config.
export const RING_CHANNEL_ID = "job_offer_ring";
const RING_SOUND = "ring_placeholder";

export async function ensureRingChannel() {
  await notifee.createChannel({
    id: RING_CHANNEL_ID,
    name: "Job Offer Ring",
    importance: AndroidImportance.HIGH,
    sound: RING_SOUND,
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

async function handleRingActionPress(event: {
  detail: { notification?: { id?: string; data?: Record<string, unknown> }; pressAction?: { id?: string } };
}) {
  const actionId = event.detail.pressAction?.id;
  const tankerIdRaw = event.detail.notification?.data?.tanker_id;
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
    await stopRingNotification();
    if (event.detail.notification?.id) {
      try {
        await notifee.cancelNotification(event.detail.notification.id);
      } catch {
        // no-op
      }
    }
  }
}

/** Register once, in mobile/index.js before the app registers. */
export function registerRingBackgroundHandler() {
  notifee.onBackgroundEvent(async (event) => {
    if (event.type !== EventType.ACTION_PRESS) return;
    await handleRingActionPress(event);
  });
}

/** Call once from a top-level component (app/_layout.tsx); returns an unsubscribe fn. */
export function registerRingForegroundHandler() {
  return notifee.onForegroundEvent((event) => {
    if (event.type !== EventType.ACTION_PRESS) return;
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
