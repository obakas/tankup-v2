const { withAndroidManifest } = require("@expo/config-plugins");

const META_DATA_NAME = "com.google.firebase.messaging.default_notification_channel_id";
const TOOLS_NAMESPACE = "http://schemas.android.com/tools";

// expo-notifications registers its own FirebaseMessagingService that also
// claims the com.google.firebase.MESSAGING_EVENT intent action, alongside
// @react-native-firebase/messaging's. Android's resolution of which service
// receives an implicit intent when two components declare the same action
// is undefined/unreliable — confirmed via a merged-manifest inspection that
// both services were present, and background FCM data messages (the ring
// payload) were never reaching the RNFirebase JS handler at all. Since the
// ring feature is entirely RNFirebase-driven and doesn't depend on
// expo-notifications' own FCM listener, remove it so only RNFirebase's
// service can win.
const EXPO_FCM_SERVICE_NAME = "expo.modules.notifications.service.ExpoFirebaseMessagingService";

// expo-notifications and @react-native-firebase/messaging both declare this
// meta-data key in their AndroidManifest.xml, which fails Android's manifest
// merger. The ring notification feature bypasses this value entirely (FCM
// Mode delivers data-only messages handled directly by notifee), so it's
// safe to just let ours win.
//
// Must be listed FIRST in app.json's plugins array: @expo/config-plugins
// composes same-mod-type (here, withAndroidManifest) actions in reverse
// registration order, so the earliest-registered plugin's mod runs last —
// this needs to run after expo-notifications' manifest mod has actually
// added the conflicting meta-data tag.
function withFirebaseMessagingManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    if (!config.modResults.manifest.$["xmlns:tools"]) {
      config.modResults.manifest.$["xmlns:tools"] = TOOLS_NAMESPACE;
    }

    const metaDataList = application["meta-data"] || [];
    const entry = metaDataList.find(
      (item) => item.$["android:name"] === META_DATA_NAME
    );
    if (entry) {
      entry.$["tools:replace"] = "android:value";
    }

    const services = application["service"] || [];
    const alreadyRemoved = services.some(
      (item) => item.$["android:name"] === EXPO_FCM_SERVICE_NAME && item.$["tools:node"] === "remove"
    );
    if (!alreadyRemoved) {
      services.push({ $: { "android:name": EXPO_FCM_SERVICE_NAME, "tools:node": "remove" } });
      application["service"] = services;
    }

    return config;
  });
}

module.exports = withFirebaseMessagingManifestFix;
