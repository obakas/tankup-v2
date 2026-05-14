import type { DriverJob, DriverStop } from "@/types/driver";

export type BatchMemberDto = {
  id: number;
  request_id: number;
  user_id?: number;
  name?: string;
  address?: string;
  phone?: string;
  volume_liters: number;
  latitude?: number | null;
  longitude?: number | null;
  payment_status?: string;
  customer_confirmed?: boolean;
  delivery_code?: string;
  delivered_at?: string | null;
};

export type TankerDto = {
  id: number;
  driver_name: string;
  phone: string;
  tank_plate_number: string;
  status: "available" | "assigned" | "loading" | "delivering" | "arrived" | "completed";
  is_available?: boolean;
};

export type BatchJobDto = {
  id: number;
  liquid_name?: string;
  current_volume?: number;
  target_volume?: number;
  volume_liters?: number;
  latitude?: number | null;
  longitude?: number | null;
};

export type PriorityJobDto = {
  id: number;
  liquid_name?: string;
  volume_liters?: number;
  latitude?: number | null;
  longitude?: number | null;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
  delivery_code?: string;
  delivered_at?: string | null;
};

export type CurrentJobResponse = {
  tanker: TankerDto;
  job_type?: "batch" | "priority" | null;
  job?: BatchJobDto | PriorityJobDto | null;
  members?: BatchMemberDto[];
};

function mapMemberToStop(member: BatchMemberDto): DriverStop {
  return {
    id: member.request_id ?? member.id,
    name: member.name ?? "Customer",
    address: member.address ?? "No address provided",
    phone: member.phone,
    volumeLiters: member.volume_liters,
    otp: member.delivery_code,
    delivered: !!member.customer_confirmed || !!member.delivered_at,
    latitude: member.latitude ?? undefined,
    longitude: member.longitude ?? undefined,
  };
}

export function mapCurrentJobResponseToDriverJob(
  data: CurrentJobResponse | null | undefined
): DriverJob | null {
  if (!data || !data.job_type || !data.job) {
    return null;
  }

  if (data.job_type === "batch") {
    const batchJob = data.job as BatchJobDto;

    return {
      batchId: batchJob.id,
      jobType: "batch",
      status: data.tanker.status === "available" ? "assigned" : data.tanker.status,
      liquidName: batchJob.liquid_name,
      totalVolumeLiters:
        batchJob.target_volume ??
        batchJob.current_volume ??
        batchJob.volume_liters,
      stops: (data.members ?? []).map(mapMemberToStop),
    };
  }

  const priorityJob = data.job as PriorityJobDto;

  return {
    batchId: priorityJob.id,
    jobType: "priority",
    status: data.tanker.status === "available" ? "assigned" : data.tanker.status,
    liquidName: priorityJob.liquid_name,
    totalVolumeLiters: priorityJob.volume_liters,
    stops: [
      {
        id: priorityJob.id,
        name: priorityJob.customer_name ?? "Priority Customer",
        address: priorityJob.customer_address ?? "No address provided",
        phone: priorityJob.customer_phone,
        volumeLiters: priorityJob.volume_liters ?? 0,
        otp: priorityJob.delivery_code,
        delivered: !!priorityJob.delivered_at,
        latitude: priorityJob.latitude ?? undefined,
        longitude: priorityJob.longitude ?? undefined,
      },
    ],
  };
}