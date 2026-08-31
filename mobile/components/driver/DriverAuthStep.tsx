import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { driverLogin, DriverResponse } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { useAppTheme } from "@/hooks/useAppTheme";

export function DriverAuthStep({ onComplete }: { onComplete: (d: DriverResponse) => void }) {
  const { theme } = useAppTheme();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!phone.trim()) {
      setError("Phone required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const d = await driverLogin({ phone: phone.trim() });
      onComplete(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-4">
      {error && (
        <View className="bg-red-50 border border-red-200 rounded-xl p-3">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      )}

      <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+234..." keyboardType="phone-pad" />

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        className="rounded-xl py-4 items-center mt-2"
        style={{ backgroundColor: theme.success }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Sign In</Text>}
      </Pressable>

      <Text className="text-sm text-center" style={{ color: theme.mutedForeground }}>
        New driver signups are paused — ask your fleet head to add you.
      </Text>
    </View>
  );
}
