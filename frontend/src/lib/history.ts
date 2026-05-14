const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8000";

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

async function apiGet<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.detail || "Request failed");
    }

    return data as T;
}

export function fetchClientHistory(userId: number) {
    return apiGet<ClientHistoryResponse>(`/history/users/${userId}`);
}

export function fetchDriverHistory(tankerId: number) {
    return apiGet<DriverHistoryResponse>(`/history/tankers/${tankerId}`);
}