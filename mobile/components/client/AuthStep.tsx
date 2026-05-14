import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { loginUser, createUser, UserResponse } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { CurrentUser } from "@/types/client";

// type AuthMode = "signup" | "login";

// interface AuthStepProps {
//   mode: AuthMode;
//   onSuccess: (user: UserResponse) => void;
//   onModeChange: (mode: AuthMode) => void;
// }
type AuthStepProps = {
  onComplete: (user: CurrentUser) => void;
};

// export function AuthStep({ mode, onSuccess, onModeChange }: AuthStepProps) {
export function AuthStep({ onComplete }: AuthStepProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"login" | "signup">("login");

  const isSignup = mode === "signup";

  // const isSignup = mode === "signup";

  const handleSubmit = async () => {
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }

    if (isSignup && (!name.trim() || !address.trim())) {
      setError("Name, phone number, and address are required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const user = isSignup
        ? await createUser({
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
          })
        : await loginUser({
            phone: phone.trim(),
          });

      onComplete(user);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : isSignup
          ? "Failed to create account"
          : "Failed to log in"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-4">
      <View className="flex-row rounded-xl border border-border p-1 bg-muted/30">
        <Pressable
          onPress={() => setMode("signup")}
          className={`flex-1 rounded-lg py-3 items-center ${
            isSignup ? "bg-background" : ""
          }`}
        >
          <Text className={isSignup ? "text-foreground font-semibold" : "text-muted"}>
            Sign Up
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setMode("login")}
          className={`flex-1 rounded-lg py-3 items-center ${
            !isSignup ? "bg-background" : ""
          }`}
        >
          <Text className={!isSignup ? "text-foreground font-semibold" : "text-muted"}>
            Log In
          </Text>
        </Pressable>
      </View>

      {error && (
        <View className="bg-red-50 border border-red-200 rounded-xl p-3">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      )}

      {isSignup && (
        <>
          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Amina Hassan"
          />

          <Input
            label="Delivery Address"
            value={address}
            onChangeText={setAddress}
            placeholder="12 Gana St, Maitama, Abuja"
          />
        </>
      )}

      <Input
        label="Phone Number"
        value={phone}
        onChangeText={setPhone}
        placeholder="+234..."
        keyboardType="phone-pad"
      />

      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        className="bg-primary rounded-xl py-4 items-center mt-2 disabled:opacity-60"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold">
            {isSignup ? "Create Account" : "Log In"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}