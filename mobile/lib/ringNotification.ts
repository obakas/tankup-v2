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
