const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function downloadPdf(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Failed to download receipt");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCustomerReceipt(requestId: number): Promise<void> {
  return downloadPdf(`/history/receipts/${requestId}`, `tankup-receipt-${requestId}.pdf`);
}

export function downloadDriverReceipt(
  tankerId: number,
  jobType: "batch" | "priority",
  jobId: number
): Promise<void> {
  return downloadPdf(
    `/history/tankers/${tankerId}/receipts/${jobType}/${jobId}`,
    `tankup-driver-receipt-${jobType}-${jobId}.pdf`
  );
}
