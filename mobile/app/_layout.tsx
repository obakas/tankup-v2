import "@/global.css";
import "@/tasks/locationTask";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import messaging from "@react-native-firebase/messaging";
import notifee from "react-native-notify-kit";
import { registerRingForegroundHandler } from "@/lib/ringNotification";

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Expo Go — push notifications not supported
}

// Android 8+ requires a notification channel for background push delivery.
// Without this, the OS silently drops all background notifications.
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
  });
}
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { ThemeProvider, useAppTheme } from "@/hooks/useAppTheme";

function AppShell() {
  const { isDark, theme } = useAppTheme();

  useEffect(() => {
    const unsubscribeForegroundEvents = registerRingForegroundHandler();
    const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
      // RemoteMessage.data is typed loosely (string | object); FCM payloads we
      // send are always plain strings, matching notifee's FcmRemoteMessage shape.
      await notifee.handleFcmMessage(remoteMessage as any);
    });
    return () => {
      unsubscribeForegroundEvents();
      unsubscribeMessage();
    };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
