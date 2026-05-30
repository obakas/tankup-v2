import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { HelpCircle, X } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { openWhatsApp } from "@/lib/support";

const CATEGORIES = [
  { label: "Payment Issue", description: "Report a failed charge or payment confirmation problem" },
  { label: "Delivery Delay", description: "Get help if your delivery is taking too long" },
  { label: "OTP / Customer Issue", description: "Resolve issues with delivery confirmation or the customer" },
  { label: "Cancellation Question", description: "Questions about job cancellations and penalties" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  batchId?: number | null;
  tankerId?: number | null;
};

export function DriverHelpModal({ visible, onClose, batchId, tankerId }: Props) {
  const { theme } = useAppTheme();

  const contact = (category: string) => {
    openWhatsApp(category, { batchId, tankerId });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View
          className="rounded-t-3xl p-6 gap-4"
          style={{ backgroundColor: theme.card }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <HelpCircle size={20} color={theme.success} />
              <Text className="text-lg font-bold" style={{ color: theme.foreground }}>
                Need Help?
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <X size={22} color={theme.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-2 mb-4">
              {CATEGORIES.map(({ label, description }) => (
                <Pressable
                  key={label}
                  onPress={() => contact(label)}
                  className="rounded-xl px-4 py-3 border"
                  style={{ borderColor: theme.border }}
                >
                  <Text className="text-sm font-medium" style={{ color: theme.foreground }}>
                    {label}
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: theme.mutedForeground }}>
                    {description}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => contact("General")}
              className="rounded-xl py-4 items-center"
              style={{ backgroundColor: theme.success }}
            >
              <Text className="font-semibold" style={{ color: theme.primaryForeground }}>
                Contact Support
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
