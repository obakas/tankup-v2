import { View, Text, Pressable } from "react-native";
import { XCircle, Download } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useToast } from "@/hooks/useToast";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { downloadCustomerReceipt } from "@/lib/receipts";

export function FailedStep({ requestId, onHome }: { requestId: number | null; onHome: () => void }) {
  const { theme } = useAppTheme();
  const { toast, showToast } = useToast();

  const handleDownloadReceipt = () => {
    if (!requestId) return;
    downloadCustomerReceipt(requestId).catch(() => {
      showToast("Couldn't download receipt. Please try again.", false);
    });
  };

  return (
    <View className="gap-5 items-center py-8">
      <ToastMessage toast={toast} theme={theme} />

      <View
        className="w-24 h-24 rounded-full items-center justify-center"
        style={{ backgroundColor: theme.destructiveSoft }}
      >
        <XCircle color={theme.destructive} size={48} />
      </View>

      <View className="items-center gap-2">
        <Text className="text-2xl font-bold" style={{ color: theme.foreground }}>Delivery Failed</Text>
        <Text className="text-center text-sm leading-5" style={{ color: theme.mutedForeground }}>
          Your delivery could not be completed. If you were charged, a refund will be processed. Contact support if you need help.
        </Text>
      </View>

      {requestId && (
        <Pressable
          onPress={handleDownloadReceipt}
          className="w-full rounded-xl py-4 items-center flex-row justify-center gap-2"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <Download color={theme.foreground} size={18} />
          <Text className="font-semibold" style={{ color: theme.foreground }}>Download Receipt</Text>
        </Pressable>
      )}

      <Pressable
        onPress={onHome}
        className="w-full rounded-xl py-4 items-center"
        style={{ backgroundColor: theme.primary }}
      >
        <Text className="font-semibold" style={{ color: theme.primaryForeground }}>Try Again</Text>
      </Pressable>
    </View>
  );
}
