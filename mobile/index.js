import messaging from "@react-native-firebase/messaging";
import notifee from "react-native-notify-kit";

import { ensureRingChannel, registerRingBackgroundHandler, RING_CHANNEL_ID } from "@/lib/ringNotification";

ensureRingChannel();
registerRingBackgroundHandler();

notifee.setFcmConfig({
  defaultChannelId: RING_CHANNEL_ID,
  defaultPressAction: { id: "default", launchActivity: "default" },
});

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  await notifee.handleFcmMessage(remoteMessage);
});

require("expo-router/entry");
