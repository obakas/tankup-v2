export type ClientStep =
  | "auth"
  | "request"
  | "payment"
  | "scheduled"
  | "batch"
  | "tanker"
  | "delivery"
  | "arrived"
  | "completed"
  | "expired"
  | "failed"
  | "partial";

export type RequestMode = "batch" | "priority";

export interface ClientViewProps {
  onBack: () => void;
}
