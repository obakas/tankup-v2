import messaging from "@react-native-firebase/messaging";
import notifee from "react-native-notify-kit";

import { ensureRingChannel, registerRingBackgroundHandler, recordRingBackgroundDebug, RING_CHANNEL_ID } from "@/lib/ringNotification";

ensureRingChannel();
registerRingBackgroundHandler();

notifee.setFcmConfig({
  defaultChannelId: RING_CHANNEL_ID,
  defaultPressAction: { id: "default", launchActivity: "default" },
});

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    await notifee.handleFcmMessage(remoteMessage);
    await recordRingBackgroundDebug({ ok: true, dataKeys: Object.keys(remoteMessage?.data || {}) });
  } catch (err) {
    await recordRingBackgroundDebug({ ok: false, error: String(err), dataKeys: Object.keys(remoteMessage?.data || {}) });
  }
});

require("expo-router/entry");
