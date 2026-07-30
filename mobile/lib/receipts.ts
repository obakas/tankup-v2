import Constants from "expo-constants";
// SDK 55's expo-file-system default export replaced downloadAsync/cacheDirectory
// with a new File/Directory API — use the legacy compat module to keep this shape.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const API_BASE_URL =
  (Constants.expoConfig?.extra?.API_BASE_URL as string) ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000";

async function downloadAndShare(path: string, filename: string): Promise<void> {
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  const result = await FileSystem.downloadAsync(`${API_BASE_URL}${path}`, fileUri, {
    headers: { "ngrok-skip-browser-warning": "true" },
  });
  if (result.status !== 200) throw new Error("Failed to download receipt");
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", dialogTitle: "TankUp Receipt" });
}

export const downloadCustomerReceipt = (requestId: number) =>
  downloadAndShare(`/history/receipts/${requestId}`, `tankup-receipt-${requestId}.pdf`);

export const downloadDriverReceipt = (tankerId: number, jobType: "batch" | "priority", jobId: number) =>
  downloadAndShare(`/history/tankers/${tankerId}/receipts/${jobType}/${jobId}`, `tankup-driver-receipt-${jobType}-${jobId}.pdf`);
