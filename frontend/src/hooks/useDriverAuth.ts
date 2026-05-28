import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateDriverProfile } from "@/lib/driverApi";

export interface DriverUser {
  id: number;
  name: string;
  phone: string;
  tankerId: number;
}

const STORAGE_KEY = "driver_auth";

export const useDriverAuth = () => {
  const [driver, setDriver] = useState<DriverUser | null>(null);

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setDriver(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsHydrated(true);
  }, []);

  const loginDriver = (driverData: DriverUser) => {
    setDriver(driverData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(driverData));
    localStorage.setItem("tankup_active_role", "driver");
    toast.success(`Welcome, ${driverData.name}`);
  };

  const logoutDriver = () => {
    setDriver(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("tankup_active_role");
    toast.success("Logged out");
  };

  const updateDriver = async (payload: { driver_name?: string; tank_plate_number?: string }) => {
    if (!driver) return;
    const updated = await updateDriverProfile(driver.tankerId, payload);
    const next = { ...driver, name: updated.driver_name ?? driver.name };
    setDriver(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return {
    driver,
    isAuthenticated: !!driver,
    isHydrated,
    loginDriver,
    logoutDriver,
    updateDriver,
  };
};