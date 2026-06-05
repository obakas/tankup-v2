import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/api";

const FLEET_HEAD_TOKEN_KEY = "fleet_head_auth";
const ADMIN_SECRET = process.env.EXPO_PUBLIC_ADMIN_SECRET ?? "dev-admin-secret";

export const getFleetHeadToken = () => AsyncStorage.getItem(FLEET_HEAD_TOKEN_KEY);
export const setFleetHeadToken = (t: string) => AsyncStorage.setItem(FLEET_HEAD_TOKEN_KEY, t.trim());
export const clearFleetHeadToken = () => AsyncStorage.removeItem(FLEET_HEAD_TOKEN_KEY);

function fleetRequest<T>(
  token: string,
  endpoint: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}
) {
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      "x-admin-secret": ADMIN_SECRET,
      Authorization: `Bearer ${token}`,
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
  priority_requests: any[];
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

export interface CreateTankerPayload {
  driver_name: string;
  phone: string;
  tank_plate_number: string;
  latitude?: number;
  longitude?: number;
}

export interface OperationAlert {
  id: number;
  alert_type: string;
  severity: string;
  job_type: string;
  job_id: number;
  request_id?: number | null;
  batch_id?: number | null;
  tanker_id?: number | null;
  message: string;
  status: string;
  created_at?: string | null;
  resolved_at?: string | null;
}

export const getFleetHeadLive = (token: string) =>
  fleetRequest<LiveData>(token, "/admin/live");

export const getFleetHeadTankers = (token: string) =>
  fleetRequest<{ items: TankerCard[] }>(token, "/admin/tankers");

export const getFleetHeadOverview = (token: string) =>
  fleetRequest<OverviewData>(token, "/admin/overview");

export const getFleetHeadFinancials = (token: string) =>
  fleetRequest<FinancialSummary>(token, "/admin/financials/summary");

export const getFleetHeadAlerts = (token: string, status = "open") =>
  fleetRequest<{ items: OperationAlert[] }>(token, `/admin/operation-alerts?status=${status}&limit=50`);

export const dismissFleetHeadAlert = (token: string, alertId: number) =>
  fleetRequest<{ success: boolean }>(token, `/admin/operation-alerts/${alertId}/dismiss`, { method: "POST" });

export const registerTanker = (payload: CreateTankerPayload) =>
  apiRequest<TankerCard>("/tankers/", { method: "POST", body: payload });
