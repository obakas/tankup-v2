import { apiRequest } from "@/lib/api";

export type ActorType = "customer" | "driver" | "fleet_head" | "admin";

export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
  // Must match the corresponding entry in backend's DEFAULT_CATEGORIES
  // (notification_preference_service.py). Used as the render fallback when a
  // preferences GET hasn't resolved yet or fails — most categories are
  // opt-out (default true); arrival_ring is true opt-in (default false).
  defaultValue: boolean;
}

export const CATEGORIES: Record<ActorType, NotificationCategory[]> = {
  customer: [
    {
      key: "batch_nearby",
      label: "Batch forming nearby",
      description: "Alert when a delivery batch is forming near your site",
      defaultValue: true,
    },
    {
      key: "driver_updates",
      label: "Driver connection updates",
      description: "Notifications when your driver goes offline or reconnects mid-delivery",
      defaultValue: true,
    },
    {
      key: "delivery_progress",
      label: "Delivery progress",
      description: "Status updates as your delivery moves through each stage",
      defaultValue: true,
    },
    {
      key: "payment_updates",
      label: "Payment & receipts",
      description: "Confirmations when payments are processed or receipts are available",
      defaultValue: true,
    },
    {
      key: "email_receipt",
      label: "Email receipts",
      description: "Get a PDF receipt emailed to you after each delivery",
      defaultValue: true,
    },
    {
      key: "arrival_ring",
      label: "Ring when driver arrives",
      description: "Your phone rings with a full-screen alarm the moment your driver arrives — even if the app is closed or your phone is locked",
      defaultValue: false,
    },
  ],
  driver: [
    {
      key: "job_offers",
      label: "Incoming job offers",
      description: "Push alerts for new batch and priority delivery offers",
      defaultValue: true,
    },
    {
      key: "delivery_reminders",
      label: "Delivery reminders",
      description: "Loading deadline warnings and late-arrival reminders",
      defaultValue: true,
    },
    {
      key: "account_alerts",
      label: "Account alerts",
      description: "Updates about your driver account status",
      defaultValue: true,
    },
  ],
  fleet_head: [
    {
      key: "driver_issues",
      label: "Driver offline escalations",
      description: "Alerts when a driver goes offline during an active delivery",
      defaultValue: true,
    },
    {
      key: "loading_timeouts",
      label: "Loading timeout alerts",
      description: "Notifications when a batch or request exceeds the loading deadline",
      defaultValue: true,
    },
    {
      key: "late_arrivals",
      label: "Late arrival warnings",
      description: "Alerts when a delivery is taking longer than the expected SLA",
      defaultValue: true,
    },
    {
      key: "assignment_failures",
      label: "Assignment failures",
      description: "Notifications when a request cannot be assigned to a driver",
      defaultValue: true,
    },
  ],
  admin: [
    {
      key: "driver_issues",
      label: "Driver offline escalations",
      description: "Alerts when a driver goes offline during an active delivery",
      defaultValue: true,
    },
    {
      key: "loading_timeouts",
      label: "Loading timeout alerts",
      description: "Notifications when a batch or request exceeds the loading deadline",
      defaultValue: true,
    },
    {
      key: "late_arrivals",
      label: "Late arrival warnings",
      description: "Alerts when a delivery is taking longer than the expected SLA",
      defaultValue: true,
    },
    {
      key: "assignment_failures",
      label: "Assignment failures",
      description: "Notifications when a request cannot be assigned to a driver",
      defaultValue: true,
    },
    {
      key: "system_alerts",
      label: "System & critical alerts",
      description: "Critical platform events requiring immediate admin attention",
      defaultValue: true,
    },
  ],
};

export interface PreferencesResponse {
  actor_type: string;
  actor_id: string;
  preferences: Record<string, boolean>;
}

export async function getNotificationPreferences(
  actorType: ActorType,
  actorId: string,
  extraHeaders?: Record<string, string>
): Promise<PreferencesResponse> {
  return apiRequest<PreferencesResponse>(
    `/notifications/preferences?actor_type=${actorType}&actor_id=${encodeURIComponent(actorId)}`,
    { headers: extraHeaders }
  );
}

export async function updateNotificationPreferences(
  actorType: ActorType,
  actorId: string,
  updates: Record<string, boolean>,
  extraHeaders?: Record<string, string>
): Promise<PreferencesResponse> {
  return apiRequest<PreferencesResponse>("/notifications/preferences", {
    method: "PATCH",
    body: { actor_type: actorType, actor_id: actorId, updates },
    headers: extraHeaders,
  });
}
