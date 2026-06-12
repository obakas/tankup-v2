import { Platform } from "react-native";
import Constants from "expo-constants";

const isExpoGo =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";

export async function fireLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (Platform.OS === "web" || isExpoGo) return;
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: true },
      trigger: null,
    });
  } catch {
    // expo-notifications unavailable
  }
}

export function addNotificationArrivedListener(
  onReceived: (notification: unknown) => void
): () => void {
  if (isExpoGo) return () => {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications");
    const sub = Notifications.addNotificationReceivedListener(onReceived);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
