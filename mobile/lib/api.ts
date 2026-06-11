import Constants from "expo-constants";

const API_BASE_URL =
  (Constants.expoConfig?.extra?.API_BASE_URL as string) ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000";



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
      "ngrok-skip-browser-warning": "true",
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
  site_profile_id?: number;

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


export interface BatchLiveResponse {
  batch_id: number;
  status:
    | "forming"
    | "near_ready"
    | "ready_for_assignment"
    | "assigned"
    | "loading"
    | "delivering"
    | "arrived"
    | "completed"
    | "partially_completed"
    | "failed"
    | "expired"
    | "assignment_failed";

  current_volume: number;
  target_volume: number;
  progress_percent: number;
  member_count: number;
  
  remaining_volume?: number | null;

  tanker_id?: number | null;
  driver_name?: string | null;
  tanker_status?: string | null;
  tanker_phone?: string | null;
  tanker_latitude?: number | null;
  tanker_longitude?: number | null;
  last_location_update_at?: string | null;
  eta_minutes?: number | null;

  customer_latitude?: number | null;
  customer_longitude?: number | null;

  otp?: string | null;
  member_delivery_code?: string | null;
  delivery_code?: string | null;
  otp_verified?: boolean | null;
  otp_required?: boolean | null;

  member_id?: number | null;
  member_status?: string | null;
  member_payment_status?: string | null;
  member_delivery_status?:
    | "pending"
    | "en_route"
    | "arrived"
    | "measuring"
    | "awaiting_otp"
    | "delivered"
    | "failed"
    | "skipped"
    | null;

  refund_eligible?: boolean | null;
  refund_status?: string | null;
  refund_amount?: number | null;
  refunded_at?: string | null;
  failure_reason?: string | null;
  notes?: string | null;
  stop_order?: number | null;
  stops_ahead?: number | null;

  remaining_capacity_liters?: number | null;
  boost_available?: boolean | null;
  boost_cost_per_liter?: number | null;
  time_until_expiry_seconds?: number | null;
}

export function getBatchLive(batchId: number, memberId?: number) {
  const query = memberId !== undefined ? `?member_id=${memberId}` : "";
  return apiRequest<BatchLiveResponse>(`/batches/${batchId}/live${query}`);
}

export interface BoostInitiateResponse {
  payment_id: number;
  member_id: number;
  additional_volume: number;
  amount: number;
  status: string;
  message: string;
}

export function initiateBatchBoost(memberId: number, additionalVolume: number) {
  return apiRequest<BoostInitiateResponse>(`/batch-members/${memberId}/boost`, {
    method: "POST",
    body: { additional_volume: additionalVolume },
  });
}

export function confirmBoostPayment(paymentId: number) {
  return apiRequest<{ message: string }>(`/payments/confirm-boost/${paymentId}`, {
    method: "POST",
  });
}

export interface ClientHistoryItem {
  request_id: number;
  delivery_type: "batch" | "priority";
  request_status: string;
  volume_liters: number;
  created_at: string | null;
  completed_at: string | null;

  batch_id: number | null;
  member_id: number | null;
  batch_status: string | null;
  member_status: string | null;
  payment_status: string | null;
  refund_status: string | null;
  amount_paid: number | null;

  tanker_id: number | null;
  driver_name: string | null;

  delivery_id: number | null;
  delivery_status: string | null;
  planned_liters: number | null;
  actual_liters_delivered: number | null;
  otp_verified: boolean | null;
  delivered_at: string | null;
}

export interface ClientHistoryResponse {
  user_id: number;
  total: number;
  items: ClientHistoryItem[];
}

export function fetchClientHistory(userId: number) {
  return apiRequest<ClientHistoryResponse>(`/history/users/${userId}`);
}

export interface DriverHistoryItem {
  job_type: "batch" | "priority";
  job_id: number;
  tanker_id: number;
  tanker_status: string | null;
  total_stops: number;
  delivered_stops: number;
  failed_stops: number;
  skipped_stops: number;
  total_planned_liters: number;
  total_actual_liters_delivered: number;
  started_at: string | null;
  completed_at: string | null;
  last_updated_at: string | null;
  job_status: string;
  customer_name: string | null;
  customer_phone: string | null;
}

export interface DriverHistoryResponse {
  tanker_id: number;
  total: number;
  items: DriverHistoryItem[];
}

export function fetchDriverHistory(tankerId: number) {
  return apiRequest<DriverHistoryResponse>(`/history/tankers/${tankerId}`);
}

export const updateUser = (userId: number, payload: { name?: string; address?: string }) =>
  apiRequest<UserResponse>(`/users/${userId}`, { method: "PATCH", body: payload });

export type TankFloorLevel = "ground" | "first_floor" | "second_floor" | "third_floor" | "rooftop";

export interface SiteProfileCreatePayload {
  user_id: number;
  latitude: number;
  longitude: number;
  label?: string;
  address?: string;
  landmark_notes?: string;
  tank_capacity_liters?: number;
  tank_floor_level?: TankFloorLevel;
  has_gate?: boolean;
  gate_notes?: string;
}

export interface SiteProfileUpdatePayload {
  label?: string;
  address?: string;
  landmark_notes?: string;
  tank_capacity_liters?: number;
  tank_floor_level?: TankFloorLevel | null;
  has_gate?: boolean;
  gate_notes?: string;
  latitude?: number;
  longitude?: number;
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
  tank_floor_level: TankFloorLevel | null;
  tank_photo_url: string | null;
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

export const createSite = (payload: SiteProfileCreatePayload) =>
  apiRequest<SiteProfileResponse>("/sites/", { method: "POST", body: payload });

export const listUserSites = (userId: number) =>
  apiRequest<SiteProfileResponse[]>(`/sites/users/${userId}`);

export const updateSite = (siteId: number, payload: SiteProfileUpdatePayload) =>
  apiRequest<SiteProfileResponse>(`/sites/${siteId}`, { method: "PATCH", body: payload });

export const deleteSite = (siteId: number) =>
  apiRequest<void>(`/sites/${siteId}`, { method: "DELETE" });

export async function uploadSitePhoto(
  siteId: number,
  uri: string,
  mimeType: string
): Promise<SiteProfileResponse> {
  const formData = new FormData();
  const filename = uri.split("/").pop() ?? "photo.jpg";
  formData.append("file", { uri, name: filename, type: mimeType } as any);

  const response = await fetch(
    `${API_BASE_URL}/sites/${siteId}/photo`,
    {
      method: "POST",
      headers: { "ngrok-skip-browser-warning": "true" },
      body: formData,
    }
  );
  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") message = data.detail;
      else if (typeof data?.message === "string") message = data.message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text;
    }
    throw new Error(message);
  }
  return response.json();
}

// ── Driver auth ───────────────────────────────────────────────────────────────

export interface DriverResponse {
  id: number;
  name: string;
  phone: string;
  tankerId: number;
  status: string;
  is_available: boolean;
  is_online: boolean;
}

export const driverLogin = (p: { phone: string }) =>
  apiRequest<DriverResponse>("/auth/driver-login", { method: "POST", body: p });

export const driverSignup = (p: { name: string; phone: string; tank_plate_number: string; fleet_number?: string }) =>
  apiRequest<DriverResponse>("/auth/driver-signup", { method: "POST", body: p });

export const driverLogout = (tankerId: number) =>
  apiRequest(`/auth/driver-logout/${tankerId}`, { method: "POST" });

export const setDriverOnline = (tankerId: number, online: boolean, reason?: string) =>
  apiRequest(`/tankers/${tankerId}/online`, { method: "POST", body: { online, reason } });

export const driverHeartbeat = (tankerId: number) =>
  apiRequest(`/tankers/${tankerId}/heartbeat`, { method: "POST" });

export const updateDriver = (tankerId: number, payload: { driver_name?: string; tank_plate_number?: string }) =>
  apiRequest<DriverResponse>(`/tankers/${tankerId}`, { method: "PUT", body: payload });

// ── Driver job flow ───────────────────────────────────────────────────────────

export const getIncomingOffer = (tankerId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/incoming-offer`);

export const acceptOffer = (tankerId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/offers/accept`, { method: "POST" });

export const rejectOffer = (tankerId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/offers/reject`, { method: "POST" });

export const getCurrentJob = (tankerId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/current-job`);

export const markBatchStartLoading = (tankerId: number, batchId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/accept/${batchId}`, { method: "POST" });

export const markPriorityStartLoading = (tankerId: number, requestId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/accept-priority/${requestId}`, { method: "POST" });

export const markBatchLoaded = (tankerId: number, batchId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/loaded/${batchId}`, { method: "POST" });

export const markPriorityLoaded = (tankerId: number, requestId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/loaded-priority/${requestId}`, { method: "POST" });

export const completeBatchDelivery = (tankerId: number, batchId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/complete/${batchId}`, { method: "POST" });

export const completePriorityDelivery = (tankerId: number) =>
  apiRequest<any>(`/tankers/${tankerId}/complete-priority`, { method: "POST" });

// ── Delivery stop ─────────────────────────────────────────────────────────────

export const getCurrentStop = (tankerId: number) =>
  apiRequest<any>(`/deliveries/tankers/${tankerId}/current-stop`);

export const arriveAtStop = (deliveryId: number, tankerId: number) =>
  apiRequest<any>(`/deliveries/${deliveryId}/arrive?tanker_id=${tankerId}`, { method: "POST" });

export const startMeasurement = (deliveryId: number, tankerId: number, meterStartReading: number) =>
  apiRequest<any>(`/deliveries/${deliveryId}/start-measurement?tanker_id=${tankerId}`, {
    method: "POST",
    body: { meter_start_reading: meterStartReading },
  });

export const finishMeasurement = (deliveryId: number, tankerId: number, meterEndReading: number, notes?: string) =>
  apiRequest<any>(`/deliveries/${deliveryId}/finish-measurement?tanker_id=${tankerId}`, {
    method: "POST",
    body: { meter_end_reading: meterEndReading, notes },
  });

export const confirmOtp = (deliveryId: number, tankerId: number, otpCode: string) =>
  apiRequest<any>(`/deliveries/${deliveryId}/confirm-otp?tanker_id=${tankerId}`, {
    method: "POST",
    body: { otp_code: otpCode },
  });

export const completeStop = (deliveryId: number, tankerId: number) =>
  apiRequest<any>(`/deliveries/${deliveryId}/complete?tanker_id=${tankerId}`, { method: "POST" });

export const failStop = (deliveryId: number, tankerId: number, reason: string) =>
  apiRequest<any>(`/deliveries/${deliveryId}/fail?tanker_id=${tankerId}`, {
    method: "POST",
    body: { reason },
  });

export const skipStop = (deliveryId: number, tankerId: number, reason: string) =>
  apiRequest<any>(`/deliveries/${deliveryId}/skip?tanker_id=${tankerId}`, {
    method: "POST",
    body: { reason },
  });

export const verifySite = (
  deliveryId: number,
  tankerId: number,
  payload: { tank_floor_level?: string; hose_distance_m?: number; road_difficulty?: number },
) =>
  apiRequest<any>(`/deliveries/${deliveryId}/verify-site?tanker_id=${tankerId}`, {
    method: "POST",
    body: payload,
  });

// type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// interface RequestOptions {
//   method?: HttpMethod;
//   body?: unknown;
//   headers?: Record<string, string>;
//   params?: Record<string, string | number | undefined>;
// }

// export async function apiRequest<T>(
//   endpoint: string,
//   options: RequestOptions = {}
// ): Promise<T> {
//   const { method = "GET", body, headers = {}, params } = options;

//   let url = `${API_BASE_URL}${endpoint}`;
//   if (params) {
//     const qs = Object.entries(params)
//       .filter(([, v]) => v !== undefined)
//       .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
//       .join("&");
//     if (qs) url += `?${qs}`;
//   }

//   const response = await fetch(url, {
//     method,
//     headers: { "Content-Type": "application/json", ...headers },
//     body: body ? JSON.stringify(body) : undefined,
//   });

//   const contentType = response.headers.get("content-type");
//   let data: unknown = null;
//   if (contentType && contentType.includes("application/json")) {
//     data = await response.json();
//   } else {
//     data = await response.text();
//   }

//   if (!response.ok) {
//     let message = "Something went wrong";
//     if (typeof data === "object" && data !== null && "detail" in data) {
//       const detail = (data as { detail?: unknown }).detail;
//       if (Array.isArray(detail)) {
//         message = detail
//           .map((i: any) => `${i.loc?.join(".")}: ${i.msg}`)
//           .join(" | ");
//       } else if (typeof detail === "string") {
//         message = detail;
//       }
//     }
//     throw new Error(message);
//   }

//   return data as T;
// }

// // ── Auth ──────────────────────────────────────────────────────────────────────

// export interface UserResponse {
//   id: number;
//   name: string;
//   phone: string;
//   address: string;
// }

// export interface DriverResponse {
//   id: number;
//   name: string;
//   phone: string;
//   tankerId: number;
//   status: string;
//   is_available: boolean;
//   is_online: boolean;
// }

// // export const loginUser = (p: { phone: string }) =>
// //   apiRequest<UserResponse>("/auth/login", { method: "POST", body: p });
// export interface LoginUserPayload {
//   phone: string;
// }

// export function loginUser(payload: LoginUserPayload) {
//   return apiRequest<UserResponse>("/auth/login", {
//     method: "POST",
//     body: payload,
//   });
// }

// // export const createUser = (p: { name: string; phone: string; address: string }) =>
// //   apiRequest<UserResponse>("/users/", { method: "POST", body: p });

// export interface CreateUserPayload {
//   name: string;
//   phone: string;
//   address: string;
// }


// export function createUser(payload: CreateUserPayload) {
//   return apiRequest<UserResponse>("/users/", {
//     method: "POST",
//     body: payload,
//   });
// }

// export const driverLogin = (p: { phone: string }) =>
//   apiRequest<DriverResponse>("/auth/driver-login", { method: "POST", body: p });

// export const driverSignup = (p: { name: string; phone: string; tank_plate_number: string }) =>
//   apiRequest<DriverResponse>("/auth/driver-signup", { method: "POST", body: p });

// export const driverLogout = (tankerId: number) =>
//   apiRequest(`/auth/driver-logout/${tankerId}`, { method: "POST" });

// // ── Requests ──────────────────────────────────────────────────────────────────

// export type DeliveryType = "batch" | "priority";

// export interface CreateRequestPayload {
//   user_id: number;
//   liquid_id: number;
//   volume_liters: number;
//   latitude: number;
//   longitude: number;
//   delivery_type: DeliveryType;
//   is_asap?: boolean;
//   scheduled_for?: string;
// }

// export interface CreateRequestResponse {
//   request_id: number;
//   delivery_type: DeliveryType;
//   request_status?: string;
//   message?: string;
//   batch_id?: number | null;
//   member_id?: number | null;
//   payment_deadline?: string | null;
//   tanker_id?: number | null;
//   tanker_status?: string | null;
//   scheduled_for?: string | null;
//   is_asap?: boolean;
// }

// export const createWaterRequest = (p: CreateRequestPayload) =>
//   apiRequest<CreateRequestResponse>("/requests/", { method: "POST", body: p });

// export const getRequestStatus = (requestId: number) =>
//   apiRequest<any>(`/requests/${requestId}/status`);

export interface PriorityLiveResponse {
  request_id: number;
  delivery_type: "priority";
  request_status: string;
  is_asap: boolean;
  scheduled_for: string | null;

  tanker_id: number | null;
  driver_name: string | null;
  tanker_phone: string | null;
  tanker_status: string | null;
  tanker_latitude: number | null;
  tanker_longitude: number | null;
  last_location_update_at: string | null;
  eta_minutes?: number | null;

  customer_latitude: number | null;
  customer_longitude: number | null;

  delivery_id: number | null;
  delivery_status:
    | "pending"
    | "en_route"
    | "arrived"
    | "measuring"
    | "awaiting_otp"
    | "delivered"
    | null;

  otp: string | null;
  otp_verified: boolean;
  otp_required: boolean;

  planned_liters: number | null;
  actual_liters_delivered: number | null;
  meter_start_reading: number | null;
  meter_end_reading: number | null;
  arrived_at: string | null;
  measurement_started_at: string | null;
  measurement_completed_at: string | null;
  delivered_at: string | null;
  customer_confirmed: boolean;
  failure_reason: string | null;
  notes: string | null;
}

export const getPriorityRequestLive = (requestId: number) =>
  apiRequest<PriorityLiveResponse>(`/requests/${requestId}/live`);

export interface CancelPriorityResponse {
  message: string;
  request_id: number;
  status: string;
  cancellation_stage: "pre_loading" | "en_route" | "arrived" | "partial_delivery";
  refund_percentage: number;
  refund_eligible: boolean;
}

export const cancelPriorityRequest = (requestId: number) =>
  apiRequest<CancelPriorityResponse>(`/requests/${requestId}/cancel`, { method: "POST" });

// export const getActivePriorityRequest = (userId: number) =>
//   apiRequest<any>(`/requests/users/${userId}/active-priority`);

// // ── Batch Members ─────────────────────────────────────────────────────────────

// export const leaveBatchMember = (memberId: number) =>
//   apiRequest(`/batch-members/${memberId}/leave`, { method: "POST" });

// export const confirmPayment = (memberId: number) =>
//   apiRequest(`/batch-members/${memberId}/confirm-payment`, { method: "POST" });

// // ── Batches ───────────────────────────────────────────────────────────────────

// export const getBatchLive = (batchId: number, memberId?: number) =>
//   apiRequest<any>(`/batches/${batchId}/live`, {
//     params: memberId !== undefined ? { member_id: memberId } : undefined,
//   });

// // ── Tankers / Driver ──────────────────────────────────────────────────────────

// export const getIncomingOffer = (tankerId: number) =>
//   apiRequest<any>(`/tankers/${tankerId}/incoming-offer`);

// export const acceptOffer = (tankerId: number) =>
//   apiRequest<any>(`/tankers/${tankerId}/offers/accept`, { method: "POST" });

// export const rejectOffer = (tankerId: number) =>
//   apiRequest<any>(`/tankers/${tankerId}/offers/reject`, { method: "POST" });

// export const getCurrentJob = (tankerId: number) =>
//   apiRequest<any>(`/tankers/${tankerId}/current-job`);

// export const markBatchLoaded = (tankerId: number, batchId: number) =>
//   apiRequest<any>(`/tankers/${tankerId}/loaded/${batchId}`, { method: "POST" });

// export const markPriorityLoaded = (tankerId: number, requestId: number) =>
//   apiRequest<any>(`/tankers/${tankerId}/loaded-priority/${requestId}`, { method: "POST" });

// export const completeBatchDelivery = (tankerId: number, batchId: number) =>
//   apiRequest<any>(`/tankers/${tankerId}/complete/${batchId}`, { method: "POST" });

// export const completePriorityDelivery = (tankerId: number) =>
//   apiRequest<any>(`/tankers/${tankerId}/complete-priority`, { method: "POST" });

// export const updateTankerLocation = (tankerId: number, latitude: number, longitude: number) =>
//   apiRequest<any>(`/tankers/${tankerId}/location`, {
//     method: "POST",
//     body: { latitude, longitude },
//   });

// // ── Deliveries ────────────────────────────────────────────────────────────────

// export const getCurrentStop = (tankerId: number) =>
//   apiRequest<any>(`/deliveries/tankers/${tankerId}/current-stop`);

// export const arriveAtStop = (deliveryId: number, tankerId: number) =>
//   apiRequest<any>(`/deliveries/${deliveryId}/arrive`, {
//     method: "POST",
//     params: { tanker_id: tankerId },
//   });

// export const startMeasurement = (
//   deliveryId: number,
//   tankerId: number,
//   meterStartReading: number
// ) =>
//   apiRequest<any>(`/deliveries/${deliveryId}/start-measurement`, {
//     method: "POST",
//     params: { tanker_id: tankerId },
//     body: { meter_start_reading: meterStartReading },
//   });

// export const finishMeasurement = (
//   deliveryId: number,
//   tankerId: number,
//   meterEndReading: number,
//   notes?: string
// ) =>
//   apiRequest<any>(`/deliveries/${deliveryId}/finish-measurement`, {
//     method: "POST",
//     params: { tanker_id: tankerId },
//     body: { meter_end_reading: meterEndReading, notes },
//   });

// export const confirmOtp = (deliveryId: number, tankerId: number, otpCode: string) =>
//   apiRequest<any>(`/deliveries/${deliveryId}/confirm-otp`, {
//     method: "POST",
//     params: { tanker_id: tankerId },
//     body: { otp_code: otpCode },
//   });

// export const completeStop = (deliveryId: number, tankerId: number) =>
//   apiRequest<any>(`/deliveries/${deliveryId}/complete`, {
//     method: "POST",
//     params: { tanker_id: tankerId },
//   });

// export const failStop = (deliveryId: number, tankerId: number, reason: string) =>
//   apiRequest<any>(`/deliveries/${deliveryId}/fail`, {
//     method: "POST",
//     params: { tanker_id: tankerId },
//     body: { reason },
//   });

// export const skipStop = (deliveryId: number, tankerId: number, reason: string) =>
//   apiRequest<any>(`/deliveries/${deliveryId}/skip`, {
//     method: "POST",
//     params: { tanker_id: tankerId },
//     body: { reason },
//   });

export function updatePushToken(userId: number, token: string) {
  return apiRequest(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ expo_push_token: token }),
  });
}

export function updateDriverPushToken(tankerId: number, token: string) {
  return apiRequest(`/tankers/${tankerId}/push-token`, {
    method: "PATCH",
    body: JSON.stringify({ expo_push_token: token }),
  });
}
