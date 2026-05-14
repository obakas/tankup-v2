import { View, Text, Pressable } from "react-native";

export function FailedStep({ onHome }: { onHome: () => void }) {
  return (
    <View className="gap-4 items-center py-8">
      <Text className="text-foreground text-2xl font-bold">Delivery Failed</Text>

      <Text className="text-muted-foreground text-center">
        Your delivery could not be completed. Please try again or contact support.
      </Text>

      <Pressable
        onPress={onHome}
        className="w-full bg-primary rounded-xl py-4 items-center"
      >
        <Text className="text-white font-semibold">Back to Home</Text>
      </Pressable>
    </View>
  );
}