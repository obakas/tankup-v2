import { Alert, Platform } from "react-native";

export type PushTokens = {
  expoPushToken: string | null;
  fcmToken: string | null;
};

export async function registerForPushNotificationsAsync(): Promise<PushTokens> {
  if (Platform.OS === "web") return { expoPushToken: null, fcmToken: null };

  let expoPushToken: string | null = null;
  try {
    const Notifications = await import("expo-notifications");

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[PushNotifications] permission not granted:", finalStatus);
    } else {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "5f921855-fc23-4271-926b-2534f00d4012",
      });
      expoPushToken = tokenData.data;
    }
  } catch (err) {
    console.error("[PushNotifications] expo token registration failed:", err);
  }

  // Powers the call-style ring for job offers (delivered via raw FCM data
  // messages, bypassing Expo's push transport) — see push_service.py's
  // notify_driver_ring. Failure here just means that driver falls back to the
  // ordinary Expo push path server-side.
  let fcmToken: string | null = null;
  try {
    const messaging = (await import("@react-native-firebase/messaging")).default;
    fcmToken = await messaging().getToken();
    if (!fcmToken) {
      // getToken() resolving with an empty value is otherwise silent —
      // surfacing it directly avoids needing a device-connected debugger
      // to notice the call-style ring feature has quietly stopped working.
      Alert.alert("Ring setup", "FCM getToken() returned empty — job offer ringing won't work until this is fixed.");
    }
  } catch (err) {
    console.error("[PushNotifications] fcm token registration failed:", err);
    Alert.alert("Ring setup failed", String(err instanceof Error ? err.message : err));
  }

  return { expoPushToken, fcmToken };
}
