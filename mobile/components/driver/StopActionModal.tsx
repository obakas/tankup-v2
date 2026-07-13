import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { AlertTriangle, X } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

const SKIP_REASONS = ["Customer unavailable", "Asked to reschedule", "Wrong/incomplete address", "Other"];

const FAIL_REASONS = [
  "Customer refused",
  "Tank too high / hose too short",
  "Customer aggression / safety",
  "Payment dispute",
  "Other",
];

const SITE_TOO_DIFFICULT_REASON = "Tank too high / hose too short";

type Props = {
  visible: boolean;
  mode: "skip" | "fail";
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (reason: string, reasonCode?: string) => void;
};

export function StopActionModal({ visible, mode, loading, error, onClose, onSubmit }: Props) {
  const { theme } = useAppTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setReason("");
    }
  }, [visible, mode]);

  const isFail = mode === "fail";
  const accent = isFail ? theme.destructive : theme.foreground;
  const accentSoft = isFail ? theme.destructiveSoft : theme.warningSoft;
  const reasons = isFail ? FAIL_REASONS : SKIP_REASONS;
  const title = isFail ? "Mark delivery as failed?" : "Skip this stop?";
  const subtitle = isFail
    ? "This ends the stop as failed and moves on to the next one. The reason is logged."
    : "This skips the stop for now and moves on to the next one. The reason is logged.";
  const submitLabel = isFail ? "Mark as Failed" : "Skip Stop";

  const handleChip = (label: string) => {
    setSelected(label);
    if (label !== "Other") {
      setReason(label);
    } else {
      setReason("");
    }
  };

  const canSubmit = reason.trim().length >= 3 && !loading;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <View className="rounded-t-3xl p-6 gap-4" style={{ backgroundColor: theme.card, maxHeight: "85%" }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={20} color={accent} />
              <Text className="text-lg font-bold" style={{ color: theme.foreground }}>
                {title}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <X size={22} color={theme.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text className="text-sm mb-3" style={{ color: theme.mutedForeground }}>
              {subtitle}
            </Text>

            <View className="flex-row flex-wrap gap-2 mb-4">
              {reasons.map((label) => {
                const isSelected = selected === label;
                return (
                  <Pressable
                    key={label}
                    onPress={() => handleChip(label)}
                    className="rounded-xl px-3 py-2 border"
                    style={{
                      borderColor: isSelected ? accent : theme.border,
                      backgroundColor: isSelected ? accentSoft : "transparent",
                    }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: isSelected ? accent : theme.foreground }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              placeholder={isFail ? "Why did delivery fail?" : "Why are you skipping?"}
              placeholderTextColor={theme.mutedForeground}
              value={reason}
              onChangeText={(t) => {
                setReason(t);
                setSelected(null);
              }}
              multiline
              numberOfLines={3}
              className="rounded-xl border p-3 text-sm mb-4"
              style={{
                borderColor: theme.border,
                color: theme.foreground,
                backgroundColor: theme.input,
                minHeight: 72,
                textAlignVertical: "top",
              }}
            />

            {error && (
              <Text className="text-sm mb-3" style={{ color: theme.destructive }}>
                {error}
              </Text>
            )}

            <Pressable
              onPress={() =>
                onSubmit(
                  reason.trim(),
                  selected === SITE_TOO_DIFFICULT_REASON ? "site_too_difficult" : undefined
                )
              }
              disabled={!canSubmit}
              className="rounded-xl py-4 items-center"
              style={{ backgroundColor: accent, opacity: canSubmit ? 1 : 0.5 }}
            >
              {loading ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <Text className="font-semibold" style={{ color: theme.primaryForeground }}>
                  {submitLabel}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
