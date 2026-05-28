import { Text, View } from "react-native";
import { type TankupTheme } from "@/components/ui/theme";
import { type ToastState } from "@/hooks/useToast";

type Props = {
  toast: ToastState;
  theme: TankupTheme;
  /** Distance from top of the safe area — defaults to 16 */
  top?: number;
};

export function ToastMessage({ toast, theme, top = 16 }: Props) {
  if (!toast) return null;

  return (
    <View
      style={{
        position: "absolute",
        top,
        left: 16,
        right: 16,
        zIndex: 999,
        backgroundColor: toast.ok ? theme.successSoft : theme.destructiveSoft,
        borderWidth: 1,
        borderColor: toast.ok ? theme.success : theme.destructive,
        borderRadius: 12,
        padding: 12,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
      <Text
        style={{
          color: toast.ok ? theme.success : theme.destructive,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {toast.msg}
      </Text>
    </View>
  );
}
