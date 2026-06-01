import { apiRequest } from "@/lib/api";

export type ActorType = "customer" | "driver" | "fleet_head" | "admin";

export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
}

export const CATEGORIES: Record<ActorType, NotificationCategory[]> = {
  customer: [
    {
      key: "batch_nearby",
      label: "Batch forming nearby",
      description: "Alert when a delivery batch is forming near your site",
    },
    {
      key: "driver_updates",
      label: "Driver connection updates",
      description: "Notifications when your driver goes offline or reconnects mid-delivery",
    },
    {
      key: "delivery_progress",
      label: "Delivery progress",
      description: "Status updates as your delivery moves through each stage",
    },
    {
      key: "payment_updates",
      label: "Payment & receipts",
      description: "Confirmations when payments are processed or receipts are available",
    },
  ],
  driver: [
    {
      key: "job_offers",
      label: "Incoming job offers",
      description: "Push alerts for new batch and priority delivery offers",
    },
    {
      key: "delivery_reminders",
      label: "Delivery reminders",
      description: "Loading deadline warnings and late-arrival reminders",
    },
    {
      key: "account_alerts",
      label: "Account alerts",
      description: "Updates about your driver account status",
    },
  ],
  fleet_head: [
    {
      key: "driver_issues",
      label: "Driver offline escalations",
      description: "Alerts when a driver goes offline during an active delivery",
    },
    {
      key: "loading_timeouts",
      label: "Loading timeout alerts",
      description: "Notifications when a batch or request exceeds the loading deadline",
    },
    {
      key: "late_arrivals",
      label: "Late arrival warnings",
      description: "Alerts when a delivery is taking longer than the expected SLA",
    },
    {
      key: "assignment_failures",
      label: "Assignment failures",
      description: "Notifications when a request cannot be assigned to a driver",
    },
  ],
  admin: [
    {
      key: "driver_issues",
      label: "Driver offline escalations",
      description: "Alerts when a driver goes offline during an active delivery",
    },
    {
      key: "loading_timeouts",
      label: "Loading timeout alerts",
      description: "Notifications when a batch or request exceeds the loading deadline",
    },
    {
      key: "late_arrivals",
      label: "Late arrival warnings",
      description: "Alerts when a delivery is taking longer than the expected SLA",
    },
    {
      key: "assignment_failures",
      label: "Assignment failures",
      description: "Notifications when a request cannot be assigned to a driver",
    },
    {
      key: "system_alerts",
      label: "System & critical alerts",
      description: "Critical platform events requiring immediate admin attention",
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
