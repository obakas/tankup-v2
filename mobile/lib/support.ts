import { Linking } from "react-native";

// Replace with your WhatsApp Business number (digits only, with country code)
export const SUPPORT_WHATSAPP = "2348000000000";

export async function openWhatsApp(category: string, context: {
  batchId?: number | null;
  requestId?: number | null;
  tankerId?: number | null;
}) {
  const parts = [`[TankUp Support] Category: ${category}`];
  if (context.batchId) parts.push(`Batch ID: ${context.batchId}`);
  if (context.requestId) parts.push(`Request ID: ${context.requestId}`);
  if (context.tankerId) parts.push(`Tanker ID: ${context.tankerId}`);
  const text = encodeURIComponent(parts.join(" | "));
  const url = `https://wa.me/${SUPPORT_WHATSAPP}?text=${text}`;
  await Linking.openURL(url);
}
