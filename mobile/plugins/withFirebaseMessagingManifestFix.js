const { withAndroidManifest } = require("@expo/config-plugins");

const META_DATA_NAME = "com.google.firebase.messaging.default_notification_channel_id";
const TOOLS_NAMESPACE = "http://schemas.android.com/tools";

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

    return config;
  });
}

module.exports = withFirebaseMessagingManifestFix;
