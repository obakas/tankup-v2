import messaging from "@react-native-firebase/messaging";
import notifee from "react-native-notify-kit";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ensureRingChannel,
  registerRingBackgroundHandler,
  registerRingForegroundService,
  displayRingNotification,
  recordRingBackgroundDebug,
  RING_CHANNEL_ID,
} from "@/lib/ringNotification";
import { updateDriverPushToken } from "@/lib/api";

// Must match DRIVER_AUTH_KEY in hooks/useDriverFlow.ts and app/index.tsx.
const DRIVER_AUTH_KEY = "driver_auth";

ensureRingChannel();
registerRingBackgroundHandler();
registerRingForegroundService();

notifee.setFcmConfig({
  defaultChannelId: RING_CHANNEL_ID,
  defaultPressAction: { id: "default", launchActivity: "default" },
});

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    // displayRingNotification (not handleFcmMessage) — see its doc comment in
    // ringNotification.ts for why the auto-reconstruction path can't be used.
    await displayRingNotification(remoteMessage);
    await recordRingBackgroundDebug({ ok: true, dataKeys: Object.keys(remoteMessage?.data || {}) });
  } catch (err) {
    await recordRingBackgroundDebug({ ok: false, error: String(err), dataKeys: Object.keys(remoteMessage?.data || {}) });
  }
});

// FCM tokens rotate (reinstalls, Play Services updates, Firebase's own token
// expiry policy). Runs at module scope outside React, so the tanker id is
// read straight from AsyncStorage rather than component state.
messaging().onTokenRefresh(async (fcmToken) => {
  try {
    const raw = await AsyncStorage.getItem(DRIVER_AUTH_KEY);
    const driver = raw ? JSON.parse(raw) : null;
    if (driver?.tankerId) {
      await updateDriverPushToken(driver.tankerId, undefined, fcmToken);
    }
  } catch {
    // no-op: token will still be re-sent on next login
  }
});

require("expo-router/entry");
