import { apiRequest } from "@/lib/api";
import type { AdminRequestItem } from "@/lib/admin";

const FLEET_HEAD_TOKEN_KEY = "fleet_head_auth";
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || "dev-admin-secret";

export const getFleetHeadToken = () => localStorage.getItem(FLEET_HEAD_TOKEN_KEY) || "";
export const setFleetHeadToken = (t: string) => localStorage.setItem(FLEET_HEAD_TOKEN_KEY, t.trim());
export const clearFleetHeadToken = () => localStorage.removeItem(FLEET_HEAD_TOKEN_KEY);

function fleetRequest<T>(endpoint: string, options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}) {
  const token = getFleetHeadToken();
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      "x-admin-secret": ADMIN_SECRET,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function loginFleetHead(username: string, password: string): Promise<string> {
  const res = await apiRequest<{ access_token: string }>("/admin/login", {
    method: "POST",
    body: { username, password },
  });
  return res.access_token;
}

export interface TankerCard {
  id: number;
  driver_name: string;
  phone: string;
  tank_plate_number: string;
  status: string;
  is_available: boolean;
  is_online: boolean;
  current_request_id: number | null;
  active_batch_id: number | null;
  active_request_status: string | null;
  pending_offer_type: string | null;
  pending_offer_id: number | null;
  offer_expires_at: string | null;
  latitude: number | null;
  longitude: number | null;
  last_location_update_at: string | null;
  paused_until?: string | null;
}

export interface BatchCard {
  id: number;
  status: string;
  current_volume: number;
  target_volume: number;
  fill_percent: number;
  member_count: number;
  paid_member_count: number;
  tanker_id: number | null;
  deliveries_completed: number;
  deliveries_total: number;
  created_at: string | null;
  expires_at: string | null;
  loading_deadline: string | null;
}

export interface DeliveryCard {
  id: number;
  job_type: string;
  batch_id: number | null;
  request_id: number | null;
  tanker_id: number | null;
  user_id: number | null;
  user_name: string | null;
  delivery_status: string;
  stop_order: number | null;
  planned_liters: number;
  actual_liters_delivered: number | null;
  otp_verified: boolean;
  failure_reason: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
}

export interface LiveData {
  generated_at: string;
  batches: BatchCard[];
  tankers: TankerCard[];
  deliveries: DeliveryCard[];
  priority_requests: AdminRequestItem[];
}

export interface OverviewData {
  generated_at: string;
  totals: Record<string, number>;
  payment_value: { total: number; paid: number };
  status_breakdown: {
    batches: Record<string, number>;
    tankers: Record<string, number>;
    deliveries: Record<string, number>;
  };
}

export interface FinancialSummary {
  total_revenue: number;
  total_refunded: number;
  net_revenue: number;
  payment_counts: Record<string, number>;
  refund_counts: Record<string, number>;
}

export const getFleetHeadLive = () => fleetRequest<LiveData>("/admin/live");
export const getFleetHeadTankers = () => fleetRequest<{ items: TankerCard[] }>("/admin/tankers");
export const getFleetHeadOverview = () => fleetRequest<OverviewData>("/admin/overview");
export const getFleetHeadFinancials = () => fleetRequest<FinancialSummary>("/admin/financials/summary");

export interface CreateTankerPayload {
  driver_name: string;
  phone: string;
  tank_plate_number: string;
  latitude?: number;
  longitude?: number;
}

export const registerTanker = (payload: CreateTankerPayload) =>
  apiRequest<TankerCard>("/tankers/", { method: "POST", body: payload });

export const fleetForgiveDriver = (tankerId: number) =>
  fleetRequest<{ message: string; tanker_id: number; was_paused: boolean; status: string; is_available: boolean }>(
    `/admin/tankers/${tankerId}/forgive`,
    { method: "POST" },
  );

export const fleetPunishDriver = (tankerId: number, hours: 2 | 24 | 48) =>
  fleetRequest<{ message: string; tanker_id: number; paused_until: string }>(
    `/admin/tankers/${tankerId}/punish`,
    { method: "POST", body: { hours } },
  );

export interface PendingRequestItem {
  id: number;
  delivery_type: string;
  status: string;
  volume_liters: number;
  is_asap: boolean;
  scheduled_for: string | null;
  created_at: string | null;
}

export interface ForceOfferResult {
  message: string;
  request_id: number;
  tanker_id: number;
  offer_id: number;
  offer_expires_at: string | null;
}

export const getFleetHeadPendingRequests = () =>
  fleetRequest<{ items: PendingRequestItem[]; total: number }>(
    "/admin/requests?delivery_type=priority&status=pending&status=searching_driver&limit=50"
  );

export const forceOfferToTanker = (requestId: number, tankerId: number) =>
  fleetRequest<ForceOfferResult>(
    `/admin/requests/${requestId}/offer/${tankerId}`,
    { method: "POST" }
  );
