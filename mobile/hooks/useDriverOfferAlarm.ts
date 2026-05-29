import { useCallback } from "react";
import { Vibration } from "react-native";
import { toast } from "@/lib/toast";

const VIBRATION_PATTERN = [0, 400, 200, 400, 200, 400];

export function useDriverOfferAlarm() {
  const triggerAlarm = useCallback((offerType: string = "batch") => {
    const label = offerType === "priority" ? "Priority" : "Batch";
    toast.info(`New ${label} job offer!`);
    Vibration.vibrate(VIBRATION_PATTERN, true);
  }, []);

  const cancelAlarm = useCallback(() => {
    Vibration.cancel();
  }, []);

  return { triggerAlarm, cancelAlarm };
}
