import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateTankerLocation } from "@/lib/driverApi";

export const LOCATION_TASK_NAME = "tankup-bg-location";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  if (error || !data) return;
  const { locations } = data;
  const loc = locations[0];
  if (!loc) return;

  const authStr = await AsyncStorage.getItem("driver_auth");
  if (!authStr) return;
  const auth = JSON.parse(authStr) as { tankerId?: number };
  if (!auth.tankerId) return;

  try {
    await updateTankerLocation(auth.tankerId, loc.coords.latitude, loc.coords.longitude);
  } catch {
    // silent — background failures must not disturb the task runner
  }
});
