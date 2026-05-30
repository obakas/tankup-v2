import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { AlertTriangle, X } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { apiRequest } from "@/lib/api";

const CUSTOMER_CATEGORIES = [
  { key: "DRIVER_MISCONDUCT", label: "Driver Misconduct", description: "Unsafe, rude, or unprofessional driver behaviour" },
  { key: "QUANTITY_DISPUTE", label: "Quantity Dispute", description: "Volume delivered doesn't match what was ordered" },
  { key: "PAYMENT_CONFLICT", label: "Payment Conflict", description: "Charged incorrectly or payment not confirmed" },
  { key: "WRONG_LOCATION", label: "Wrong Location", description: "Driver went to the wrong address" },
  { key: "SAFETY_ISSUE", label: "Safety Issue", description: "Safety concern during or after delivery" },
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  batchId?: number | null;
  userId?: number | null;
  deliveryRecordId?: number | null;
  onSuccess?: () => void;
};

export function ReportIncidentModal({
  visible,
  onClose,
  batchId,
  userId,
  deliveryRecordId,
  onSuccess,
}: Props) {
  const { theme } = useAppTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setSelected(null);
    setDescription("");
    setError(null);
    setSubmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!selected) {
      setError("Please select a category.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiRequest("/incidents", {
        method: "POST",
        body: {
          incident_type: selected,
          description: description.trim() || null,
          batch_id: batchId ?? null,
          delivery_record_id: deliveryRecordId ?? null,
          reported_by_user_id: userId ?? null,
          source: "customer_app",
        },
      });
      setSubmitted(true);
      onSuccess?.();
    } catch (e: any) {
      setError(e.message ?? "Failed to submit. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View
          className="rounded-t-3xl p-6 gap-4"
          style={{ backgroundColor: theme.card, maxHeight: "85%" }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={20} color={theme.destructive} />
              <Text className="text-lg font-bold" style={{ color: theme.foreground }}>
                Report a Problem
              </Text>
            </View>
            <Pressable onPress={handleClose}>
              <X size={22} color={theme.mutedForeground} />
            </Pressable>
          </View>

          {submitted ? (
            <View className="items-center gap-4 py-6">
              <Text className="text-base font-semibold text-center" style={{ color: theme.foreground }}>
                Report received
              </Text>
              <Text className="text-sm text-center" style={{ color: theme.mutedForeground }}>
                Thank you for letting us know. Our team will review this and follow up.
              </Text>
              <Pressable
                onPress={handleClose}
                className="w-full rounded-xl py-4 items-center"
                style={{ backgroundColor: theme.primary }}
              >
                <Text className="font-semibold" style={{ color: theme.primaryForeground }}>
                  Close
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-sm mb-3" style={{ color: theme.mutedForeground }}>
                What happened?
              </Text>

              <View className="gap-2 mb-4">
                {CUSTOMER_CATEGORIES.map(({ key, label, description: desc }) => {
                  const isSelected = selected === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSelected(key)}
                      className="rounded-xl px-4 py-3 border"
                      style={{
                        borderColor: isSelected ? theme.destructive : theme.border,
                        backgroundColor: isSelected ? theme.destructiveSoft : "transparent",
                      }}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{ color: isSelected ? theme.destructive : theme.foreground }}
                      >
                        {label}
                      </Text>
                      <Text className="text-xs mt-0.5" style={{ color: theme.mutedForeground }}>
                        {desc}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                placeholder="Tell us more (optional)"
                placeholderTextColor={theme.mutedForeground}
                value={description}
                onChangeText={setDescription}
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
                onPress={submit}
                disabled={loading}
                className="rounded-xl py-4 items-center"
                style={{ backgroundColor: theme.destructive, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold" style={{ color: "#fff" }}>
                    Submit Report
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
