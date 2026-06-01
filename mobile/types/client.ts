export type ClientStep =
  | "request"
  | "payment"
  | "batch"
  | "searching"
  | "tanker"
  | "delivery"
  | "completed"
  | "expired"
  | "failed"
  | "partial";

export type RequestMode = "batch" | "priority";
export type PriorityMode = "asap" | "scheduled";

export interface CurrentUser {
  id: number;
  name: string;
  phone: string;
  address?: string;
}
