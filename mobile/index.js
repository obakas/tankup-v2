import messaging from "@react-native-firebase/messaging";
import notifee from "react-native-notify-kit";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ensureRingChannels,
  registerRingBackgroundHandler,
  registerRingForegroundService,
  displayRingNotification,
  stopArrivalRingNotification,
  recordRingBackgroundDebug,
  RING_CHANNEL_ID,
} from "@/lib/ringNotification";
import { updateDriverPushToken, updatePushToken } from "@/lib/api";

// Must match DRIVER_AUTH_KEY in hooks/useDriverFlow.ts and app/index.tsx.
const DRIVER_AUTH_KEY = "driver_auth";
// Must match CLIENT_USER_KEY in hooks/useClientFlow.ts.
const CLIENT_USER_KEY = "water_user";

ensureRingChannels();
registerRingBackgroundHandler();
registerRingForegroundService();

notifee.setFcmConfig({
  defaultChannelId: RING_CHANNEL_ID,
  defaultPressAction: { id: "default", launchActivity: "default" },
});

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    // A push confirming the delivery has moved past "arrived" (e.g. the OTP
    // push sent by finish_measurement/request_delivery_otp) means any active
    // arrival ring for this delivery should stop — the customer has already
    // been reached. displayRingNotification below is a no-op for these since
    // they carry no notifee_options payload.
    const dataType = remoteMessage?.data?.type;
    if (dataType === "delivery_otp" || dataType === "delivery_status") {
      await stopArrivalRingNotification(remoteMessage?.data?.delivery_id);
    }
    // displayRingNotification (not handleFcmMessage) — see its doc comment in
    // ringNotification.ts for why the auto-reconstruction path can't be used.
    await displayRingNotification(remoteMessage);
    await recordRingBackgroundDebug({ ok: true, dataKeys: Object.keys(remoteMessage?.data || {}) });
  } catch (err) {
    await recordRingBackgroundDebug({ ok: false, error: String(err), dataKeys: Object.keys(remoteMessage?.data || {}) });
  }
});

// FCM tokens rotate (reinstalls, Play Services updates, Firebase's own token
// expiry policy). Runs at module scope outside React, so the tanker/user id is
// read straight from AsyncStorage rather than component state.
messaging().onTokenRefresh(async (fcmToken) => {
  try {
    const [driverRaw, customerRaw] = await Promise.all([
      AsyncStorage.getItem(DRIVER_AUTH_KEY),
      AsyncStorage.getItem(CLIENT_USER_KEY),
    ]);
    const driver = driverRaw ? JSON.parse(driverRaw) : null;
    if (driver?.tankerId) {
      await updateDriverPushToken(driver.tankerId, undefined, fcmToken);
    }
    const customer = customerRaw ? JSON.parse(customerRaw) : null;
    if (customer?.id) {
      await updatePushToken(customer.id, undefined, fcmToken);
    }
  } catch {
    // no-op: token will still be re-sent on next login
  }
});

require("expo-router/entry");
