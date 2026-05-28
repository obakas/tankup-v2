import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { driverLogin, driverSignup, DriverResponse } from "@/lib/api";
import { Input } from "@/components/ui/Input";

export function DriverAuthStep({ onComplete }: { onComplete: (d: DriverResponse) => void }) {
  const [isNew, setIsNew] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
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

  const handleSignup = async () => {
    if (!phone.trim() || !name.trim() || !plate.trim()) {
      setError("All fields required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const d = await driverSignup({
        phone: phone.trim(),
        name: name.trim(),
        tank_plate_number: plate.trim(),
      });
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

      {isNew ? (
        <>
          <Input label="Full Name" value={name} onChangeText={setName} placeholder="Driver Name" />
          <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+234..." keyboardType="phone-pad" />
          <Input label="Plate Number" value={plate} onChangeText={setPlate} placeholder="ABC-123XY" />
        </>
      ) : (
        <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+234..." keyboardType="phone-pad" />
      )}

      <Pressable
        onPress={isNew ? handleSignup : handleLogin}
        disabled={loading}
        className="bg-success rounded-xl py-4 items-center mt-2"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">{isNew ? "Register" : "Sign In"}</Text>}
      </Pressable>

      <Pressable onPress={() => { setIsNew(!isNew); setError(null); }} className="items-center py-2">
        <Text className="text-success text-sm">{isNew ? "Already registered? Sign in" : "New driver? Register"}</Text>
      </Pressable>
    </View>
  );
}
