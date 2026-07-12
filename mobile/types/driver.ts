export type DriverStep =
  | "offline"
  | "available"
  | "incoming"
  | "assigned"
  | "queued"
  | "loading"
  | "delivering"
  | "completed";

export interface DriverStop {
  id: number;
  name: string;
  address: string;
  phone?: string;
  volumeLiters: number;
  otp?: string;
  delivered: boolean;
  latitude?: number;
  longitude?: number;
}

export interface DriverJob {
  jobId: number;
  jobType: "batch" | "priority";
  status: string;
  totalVolumeLiters: number;
  stops: DriverStop[];
}
