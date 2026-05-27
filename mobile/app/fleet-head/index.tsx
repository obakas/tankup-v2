import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Users, ArrowLeft } from "lucide-react-native";

export default function FleetHeadScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#e5e7eb",
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <ArrowLeft color="#111827" size={20} />
        </Pressable>
        <Text style={{ color: "#111827", fontWeight: "700", fontSize: 16, marginLeft: 8 }}>
          Fleet Management
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: "rgba(139,92,246,0.12)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Users color="#8b5cf6" size={36} />
        </View>
        <Text style={{ color: "#111827", fontSize: 22, fontWeight: "800", marginBottom: 8 }}>
          Fleet Head
        </Text>
        <Text style={{ color: "#64748b", fontSize: 15, textAlign: "center", lineHeight: 22 }}>
          The fleet management dashboard is on its way.{"\n"}Check back soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}
