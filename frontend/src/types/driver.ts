export type DriverStep =
  | "offline"
  | "available"
  | "assigned"
  | "loading"
  | "delivering"
  | "arrived"
  | "completed";

export type DriverJobType = "batch" | "priority";

export type DriverJobStatus =
  | "assigned"
  | "loading"
  | "delivering"
  | "arrived"
  | "completed"
  | "partially_completed"
  | "failed";

export type DriverStop = {
  id: number;
  name: string;
  address: string;
  phone?: string;
  volumeLiters: number;
  otp?: string;
  delivered: boolean;
  latitude?: number;
  longitude?: number;
};

export interface DriverJob {
  jobId: number;
  jobType: DriverJobType;
  status: DriverJobStatus;
  liquidName?: string;
  totalVolumeLiters: number;
  stops: DriverStop[];
}
