import { apiRequest } from "./api";

export async function requestBatchMemberRefund(memberId: number) {
  return apiRequest(`/refunds/batch-members/${memberId}`, {
    method: "POST",
  });
}