const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type");

  let data: unknown = null;

  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let message = "Something went wrong";

    if (typeof data === "object" && data !== null && "detail" in data) {
      const detail = (data as { detail?: unknown }).detail;

      if (Array.isArray(detail)) {
        message = detail
          .map((item: any) => `${item.loc?.join(".")}: ${item.msg}`)
          .join(" | ");
      } else if (typeof detail === "string") {
        message = detail;
      }
    }

    throw new Error(message);
  }

  return data as T;
}

export type DeliveryType = "batch" | "priority";
export type PriorityMode = "asap" | "scheduled";

export interface CreateRequestPayload {
  user_id: number;
  liquid_id: number;
  volume_liters: number;
  latitude: number;
  longitude: number;
  delivery_type: DeliveryType;

  // Priority only
  is_asap?: boolean;
  scheduled_for?: string;
}

export interface CreateRequestResponse {
  request_id: number;
  delivery_type: DeliveryType;

  // Common / optional response fields
  request_status?: string;
  message?: string;

  // Batch fields
  batch_id?: number | null;
  member_id?: number | null;
  payment_deadline?: string | null;

  // Priority fields
  tanker_id?: number | null;
  tanker_status?: string | null;
  scheduled_for?: string | null;
  is_asap?: boolean;
}

export function createWaterRequest(payload: CreateRequestPayload) {
  return apiRequest<CreateRequestResponse>("/requests/", {
    method: "POST",
    body: payload,
  });
}

export interface CreateUserPayload {
  name: string;
  phone: string;
  address: string;
}

export interface UserResponse {
  id: number;
  name: string;
  phone: string;
  address: string;
}

export function createUser(payload: CreateUserPayload) {
  return apiRequest<UserResponse>("/users/", {
    method: "POST",
    body: payload,
  });
}

export interface LoginUserPayload {
  phone: string;
}

export function loginUser(payload: LoginUserPayload) {
  return apiRequest<UserResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });
}

export function updateUser(userId: number, payload: { name?: string; address?: string }) {
  return apiRequest<UserResponse>(`/users/${userId}`, { method: "PATCH", body: payload });
}

export async function leaveBatchMember(memberId: number) {
  return apiRequest(`/batch-members/${memberId}/leave`, {
    method: "POST",
  });
}

export async function confirmPayment(memberId: number) {
  return apiRequest(`/batch-members/${memberId}/confirm-payment`, {
    method: "POST",
  });
}

export interface SiteProfileCreatePayload {
  user_id: number;
  latitude: number;
  longitude: number;
  label?: string;
  address?: string;
  landmark_notes?: string;
  tank_capacity_liters?: number;
  has_gate?: boolean;
  gate_notes?: string;
}

export interface SiteProfileUpdatePayload {
  label?: string;
  address?: string;
  landmark_notes?: string;
  tank_capacity_liters?: number;
  has_gate?: boolean;
  gate_notes?: string;
}

export interface SiteProfileResponse {
  id: number;
  user_id: number;
  label: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  landmark_notes: string | null;
  tank_capacity_liters: number | null;
  tank_height_m: number | null;
  hose_distance_m: number | null;
  road_difficulty: number;
  parking_difficulty: number;
  has_gate: boolean;
  gate_notes: string | null;
  delivery_count: number;
  verification_status: string;
  truthfulness_score: number;
  cooperation_score: number;
  created_at: string;
  updated_at: string;
}

export function createSite(payload: SiteProfileCreatePayload) {
  return apiRequest<SiteProfileResponse>("/sites/", { method: "POST", body: payload });
}

export function listUserSites(userId: number) {
  return apiRequest<SiteProfileResponse[]>(`/sites/users/${userId}`);
}

export function updateSite(siteId: number, payload: SiteProfileUpdatePayload) {
  return apiRequest<SiteProfileResponse>(`/sites/${siteId}`, { method: "PATCH", body: payload });
}

