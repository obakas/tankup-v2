import { useState } from "react";
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
import { apiRequest } from "@/lib/api";

const INCIDENT_CATEGORIES = [
  { key: "TANKER_BREAKDOWN", label: "Tanker Breakdown" },
  { key: "PUMP_FAILURE", label: "Pump Failure" },
  { key: "SITE_INACCESSIBLE", label: "Site Inaccessible" },
  { key: "CUSTOMER_UNAVAILABLE", label: "Customer Unavailable" },
  { key: "OTP_REFUSAL", label: "OTP Refusal" },
  { key: "QUANTITY_DISPUTE", label: "Quantity Dispute" },
  { key: "SAFETY_ISSUE", label: "Safety Issue" },
  { key: "WRONG_LOCATION", label: "Wrong Location" },
  { key: "PAYMENT_CONFLICT", label: "Payment Conflict" },
  { key: "CUSTOMER_AGGRESSION", label: "Customer Aggression" },
  { key: "DRIVER_MISCONDUCT", label: "Driver Misconduct" },
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  batchId?: number | null;
  tankerId?: number | null;
  deliveryRecordId?: number | null;
  onSuccess?: () => void;
};

export function ReportIncidentModal({
  visible,
  onClose,
  batchId,
  tankerId,
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
      setError("Please select an incident type.");
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
          tanker_id: tankerId ?? null,
          delivery_record_id: deliveryRecordId ?? null,
          reported_by_driver_id: tankerId ?? null,
          source: "driver_app",
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <View
          className="rounded-t-3xl p-6 gap-4"
          style={{ backgroundColor: theme.card, maxHeight: "85%" }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={20} color={theme.destructive} />
              <Text className="text-lg font-bold" style={{ color: theme.foreground }}>
                Report Incident
              </Text>
            </View>
            <Pressable onPress={handleClose}>
              <X size={22} color={theme.mutedForeground} />
            </Pressable>
          </View>

          {submitted ? (
            <View className="items-center gap-4 py-6">
              <Text className="text-base font-semibold text-center" style={{ color: theme.foreground }}>
                Incident reported
              </Text>
              <Text className="text-sm text-center" style={{ color: theme.mutedForeground }}>
                Your report has been received. The fleet head will be notified.
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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text className="text-sm mb-3" style={{ color: theme.mutedForeground }}>
                Select the type of incident:
              </Text>

              <View className="gap-2 mb-4">
                {INCIDENT_CATEGORIES.map(({ key, label }) => {
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
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                placeholder="Additional details (optional)"
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
                  <ActivityIndicator color={theme.primaryForeground} />
                ) : (
                  <Text className="font-semibold" style={{ color: "#fff" }}>
                    Submit Report
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
