import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DriverUser } from "@/hooks/useDriverAuth";

interface DriverProfileDialogProps {
  open: boolean;
  driver: DriverUser;
  onClose: () => void;
  onSave: (payload: { driver_name?: string; tank_plate_number?: string }) => Promise<void>;
}

export function DriverProfileDialog({ open, driver, onClose, onSave }: DriverProfileDialogProps) {
  const [name, setName] = useState(driver.name ?? "");
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setLoading(true);
    try {
      const payload: { driver_name?: string; tank_plate_number?: string } = {
        driver_name: name.trim(),
      };
      if (plate.trim()) payload.tank_plate_number = plate.trim();
      await onSave(payload);
      toast.success("Profile updated");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Driver Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tank Plate Number</label>
            <Input
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="Leave blank to keep current"
            />
            <p className="text-xs text-muted-foreground">Leave blank to keep your current plate number</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Phone</label>
            <Input value={driver.phone} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">Phone number cannot be changed</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
