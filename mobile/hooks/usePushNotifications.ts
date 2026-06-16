import { Platform } from "react-native";

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;

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
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "5f921855-fc23-4271-926b-2534f00d4012",
    });
    return tokenData.data;
  } catch (err) {
    console.error("[PushNotifications] token registration failed:", err);
    return null;
  }
}
