// Replace with your WhatsApp Business number (digits only, with country code)
export const SUPPORT_WHATSAPP = "2348000000000";

export function buildWhatsAppUrl(message: string): string {
    return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function buildHelpMessage(category: string, context: { batchId?: number | null; requestId?: number | null; driverId?: number | null }): string {
    const parts = [`[TankUp Support] Category: ${category}`];
    if (context.batchId) parts.push(`Batch ID: ${context.batchId}`);
    if (context.requestId) parts.push(`Request ID: ${context.requestId}`);
    if (context.driverId) parts.push(`Driver ID: ${context.driverId}`);
    return parts.join(" | ");
}
