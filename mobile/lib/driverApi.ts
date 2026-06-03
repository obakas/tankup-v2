import { apiRequest } from "./api";

export const driverLogin = (phone: string) =>
  apiRequest<{ id: number; name: string; phone: string }>("/drivers/login", {
    method: "POST",
    body: { phone },
  });

export const setDriverOnline = (driverId: number, online: boolean) =>
  apiRequest(`/drivers/${driverId}/availability`, {
    method: "POST",
    body: { online },
  });

export const fetchDriverJob = (driverId: number) =>
  apiRequest<any>(`/drivers/${driverId}/active-job`);

export const acceptOffer = (driverId: number, offerId: number) =>
  apiRequest(`/drivers/${driverId}/offers/${offerId}/accept`, { method: "POST" });

export const declineOffer = (driverId: number, offerId: number) =>
  apiRequest(`/drivers/${driverId}/offers/${offerId}/decline`, { method: "POST" });

export const markStopDelivered = (jobId: number, stopId: number, otp: string) =>
  apiRequest(`/jobs/${jobId}/stops/${stopId}/deliver`, {
    method: "POST",
    body: { otp },
  });

export const markJobLoaded = (jobId: number) =>
  apiRequest(`/jobs/${jobId}/loaded`, { method: "POST" });

export const completeJob = (jobId: number) =>
  apiRequest(`/jobs/${jobId}/complete`, { method: "POST" });

export const updateTankerLocation = (tankerId: number, latitude: number, longitude: number) =>
  apiRequest<void>(`/tankers/${tankerId}/location`, {
    method: "POST",
    body: { latitude, longitude },
  });
