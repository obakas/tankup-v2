const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8000";

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
        payload !== null &&
        "detail" in payload &&
        typeof (payload as { detail?: unknown }).detail === "string"
        ? (payload as { detail: string }).detail
        : `Request failed: ${response.status}`;

    throw new Error(message);
  }

  return payload as T;
}


/* =========================
   DRIVER LOCATION ENDPOINTS
========================= */

export interface TankerLocationResponse {
  tanker_id: number;
  latitude: number | null;
  longitude: number | null;
  last_location_update_at: string | null;
  tanker_status: string;
  is_available: boolean;
}

export async function updateDriverLocation(
  tankerId: number,
  payload: { latitude: number; longitude: number }
) {
  return apiRequest<TankerLocationResponse>(`/tankers/${tankerId}/location`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDriverLocation(tankerId: number) {
  return apiRequest<TankerLocationResponse>(`/tankers/${tankerId}/location`);
}

/* =========================
   TYPES
========================= */

export type DriverJobType = "batch" | "priority";

export type DeliveryStatus =
  | "pending"
  | "en_route"
  | "arrived"
  | "measuring"
  | "awaiting_otp"
  | "delivered"
  | "failed"
  | "skipped";

export interface DriverJobMember {
  id: number;
  request_id: number;
  user_id?: number | null;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  volume_liters: number;
  latitude?: number | null;
  longitude?: number | null;
  delivery_code?: string | null;
  status?: string;
  payment_status?: string;
}

export interface DriverUserResponse {
  id: number;
  name: string;
  phone: string;
  tankerId: number;
  tank_plate_number?: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  is_available?: boolean;
  is_online?: boolean;
}

export interface DriverCurrentJobResponse {
  tanker_id: number;
  tanker_status: string;
  tanker_available: boolean;
  assignment_type: DriverJobType | null;
  active_job: {
    batch_id?: number;
    request_id?: number;
    status: string;
    scheduled_for?: string | null;
    total_stops?: number;
    total_volume?: number;
    members?: DriverJobMember[];
    customer?: {
      user_id?: number | null;
      name?: string | null;
      phone?: string | null;
      address?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      volume_liters?: number | null;
      delivery_code?: string | null;
    };
  } | null;
  message?: string | null;
}

export interface TankerMeta {
  id: number;
  driver_name: string;
  phone: string;
  tank_plate_number: string;
  status: string;
  is_available: boolean;
}

export interface DeliveryJobMeta {
  job_type: DriverJobType;
  job_id: number;
  job_status: string;
  total_stops: number;
  completed_stops: number;
  remaining_stops: number;
}

export interface DeliveryCustomer {
  user_id?: number | null;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface DeliveryLocation {
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryTimestamps {
  dispatched_at?: string | null;
  arrived_at?: string | null;
  measurement_started_at?: string | null;
  measurement_completed_at?: string | null;
  delivered_at?: string | null;
}

export interface DeliveryCurrentStop {
  delivery_id: number;
  stop_order?: number | null;
  delivery_status: DeliveryStatus;
  planned_liters: number;
  actual_liters_delivered?: number | null;
  meter_start_reading?: number | null;
  meter_end_reading?: number | null;
  otp_required: boolean;
  otp_verified: boolean;
  delivery_code?: string | null;
  customer_confirmed: boolean;
  customer: DeliveryCustomer;
  location: DeliveryLocation;
  timestamps: DeliveryTimestamps;
  notes?: string | null;
  failure_reason?: string | null;
}

export interface DeliveryStopSummary {
  delivery_id: number;
  stop_order?: number | null;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
  planned_liters: number;
  delivery_status: DeliveryStatus;
}

export interface DriverCurrentStopResponse {
  tanker: TankerMeta;
  job: DeliveryJobMeta | null;
  current_stop: DeliveryCurrentStop | null;
  allowed_actions: string[];
  stops_summary: DeliveryStopSummary[];
  message?: string | null;
}

export interface DriverActionResponse {
  message: string;
  delivery?: unknown;
  current_stop?: DeliveryCurrentStop | null;
  allowed_actions?: string[];
}

/* =========================
   OFFER TYPES
========================= */

export interface IncomingDriverOffer {
  type: "priority" | "batch";
  id: number;
  expires_in_seconds: number;
  request_id?: number;
  batch_id?: number;
  volume_liters?: number;
  total_volume?: number;
  member_count?: number;
  latitude?: number | null;
  longitude?: number | null;
  delivery_type?: string;
  scheduled_for?: string | null;
}

export interface IncomingOfferResponse {
  has_offer: boolean;
  offer: IncomingDriverOffer | null;
}

/* =========================
   AUTH
========================= */

export async function loginDriver(phone: string) {
  return apiRequest<DriverUserResponse>("/auth/driver-login", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function signupDriver(
  name: string,
  phone: string,
  tank_plate_number: string,
  // latitude?: number | null,
  // longitude?: number | null,
  // tankerId?: number
) {
  return apiRequest<DriverUserResponse>("/auth/driver-signup", {
    method: "POST",
    body: JSON.stringify({
      name,
      phone,
      tank_plate_number,
      // latitude,
      // longitude,
      // tankerId,
    }),
  });
}

export async function logoutDriver(tankerId: number) {
  return apiRequest(`/auth/driver-logout/${tankerId}`, {
    method: "POST",
  });
}

/* =========================
   OFFER ENDPOINTS
========================= */

export async function fetchIncomingOffer(
  tankerId: number
): Promise<IncomingOfferResponse> {
  return apiRequest<IncomingOfferResponse>(
    `/tankers/${tankerId}/incoming-offer`
  );
}

// export async function acceptIncomingOffer(
//   tankerId: number
// ): Promise<DriverActionResponse> {
//   return apiRequest<DriverActionResponse>(
//     `/tankers/${tankerId}/offers/accept`,
//     {
//       method: "POST",
//     }
//   );
// }

export async function acceptIncomingOffer(
  tankerId: number,
  _offer?: IncomingDriverOffer
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/tankers/${tankerId}/offers/accept`,
    {
      method: "POST",
    }
  );
}

export async function rejectIncomingOffer(
  tankerId: number
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/tankers/${tankerId}/offers/reject`,
    {
      method: "POST",
    }
  );
}



/* =========================
   JOB-LEVEL ENDPOINTS
========================= */

export async function fetchCurrentDriverJob(
  tankerId: number
): Promise<DriverCurrentJobResponse> {
  return apiRequest<DriverCurrentJobResponse>(
    `/tankers/${tankerId}/current-job`
  );
}

/**
 * Legacy backend endpoints, but in the UI they really mean:
 * "move assigned job into loading state"
 */
export async function startDriverBatchLoading(
  tankerId: number,
  batchId: number
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/tankers/${tankerId}/accept/${batchId}`,
    {
      method: "POST",
    }
  );
}

export async function startDriverPriorityLoading(
  tankerId: number,
  requestId: number
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/tankers/${tankerId}/accept-priority/${requestId}`,
    {
      method: "POST",
    }
  );
}

export async function markDriverBatchLoaded(
  tankerId: number,
  batchId: number
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/tankers/${tankerId}/loaded/${batchId}`,
    {
      method: "POST",
    }
  );
}

export async function markDriverPriorityLoaded(
  tankerId: number,
  requestId: number
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/tankers/${tankerId}/loaded-priority/${requestId}`,
    {
      method: "POST",
    }
  );
}

/* =========================
   DELIVERY STOP ENDPOINTS
========================= */

export async function fetchCurrentStop(
  tankerId: number
): Promise<DriverCurrentStopResponse> {
  return apiRequest<DriverCurrentStopResponse>(
    `/deliveries/tankers/${tankerId}/current-stop`
  );
}

export async function arriveAtStop(
  tankerId: number,
  deliveryId: number
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/deliveries/${deliveryId}/arrive?tanker_id=${tankerId}`,
    {
      method: "POST",
    }
  );
}

export async function startStopMeasurement(
  tankerId: number,
  deliveryId: number,
  meterStartReading: number
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/deliveries/${deliveryId}/start-measurement?tanker_id=${tankerId}`,
    {
      method: "POST",
      body: JSON.stringify({
        meter_start_reading: meterStartReading,
      }),
    }
  );
}

export async function finishStopMeasurement(
  tankerId: number,
  deliveryId: number,
  meterEndReading: number,
  notes?: string
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/deliveries/${deliveryId}/finish-measurement?tanker_id=${tankerId}`,
    {
      method: "POST",
      body: JSON.stringify({
        meter_end_reading: meterEndReading,
        notes: notes?.trim() || null,
      }),
    }
  );
}

export async function confirmStopOtp(
  tankerId: number,
  deliveryId: number,
  otpCode: string
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/deliveries/${deliveryId}/confirm-otp?tanker_id=${tankerId}`,
    {
      method: "POST",
      body: JSON.stringify({
        otp_code: otpCode.trim(),
      }),
    }
  );
}

export async function completeStop(
  tankerId: number,
  deliveryId: number
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/deliveries/${deliveryId}/complete?tanker_id=${tankerId}`,
    {
      method: "POST",
    }
  );
}

export async function failStop(
  tankerId: number,
  deliveryId: number,
  reason: string
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/deliveries/${deliveryId}/fail?tanker_id=${tankerId}`,
    {
      method: "POST",
      body: JSON.stringify({
        reason: reason.trim(),
      }),
    }
  );
}

export async function skipStop(
  tankerId: number,
  deliveryId: number,
  reason: string
): Promise<DriverActionResponse> {
  return apiRequest<DriverActionResponse>(
    `/deliveries/${deliveryId}/skip?tanker_id=${tankerId}`,
    {
      method: "POST",
      body: JSON.stringify({
        reason: reason.trim(),
      }),
    }
  );
}