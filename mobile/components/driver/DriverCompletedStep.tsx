import { Pressable, Text, View } from "react-native";

export function DriverCompletedStep({ onBackOnline }: { onBackOnline: () => void }) {
  return (
    <View className="gap-4 items-center py-8">
      <View className="w-20 h-20 rounded-full bg-success/20 items-center justify-center">
        <Text className="text-success text-3xl">✓</Text>
      </View>
      <Text className="text-foreground text-2xl font-bold">Job Complete!</Text>
      <Text className="text-muted-foreground text-center">All stops delivered successfully.</Text>
      <Pressable onPress={onBackOnline} className="w-full bg-primary rounded-xl py-4 items-center">
        <Text className="text-white font-semibold">Back Online</Text>
      </Pressable>
    </View>
  );
}
