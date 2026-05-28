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
import { updateUser, type UserResponse } from "@/lib/api";

interface ProfileDialogProps {
  open: boolean;
  user: UserResponse;
  onClose: () => void;
  onSaved: (updated: UserResponse) => void;
}

export function ProfileDialog({ open, user, onClose, onSaved }: ProfileDialogProps) {
  const [name, setName] = useState(user.name ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!address.trim()) { toast.error("Address is required"); return; }
    setLoading(true);
    try {
      const updated = await updateUser(user.id, { name: name.trim(), address: address.trim() });
      onSaved(updated);
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
            <label className="text-sm font-medium text-foreground">Full Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Delivery Address</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your delivery address"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Phone</label>
            <Input value={user.phone} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">Phone number cannot be changed</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
