import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2, MapPin, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  updateUser,
  createSite,
  listUserSites,
  updateSite,
  type UserResponse,
  type SiteProfileResponse,
} from "@/lib/api";

interface ProfileDialogProps {
  open: boolean;
  user: UserResponse;
  onClose: () => void;
  onSaved: (updated: UserResponse) => void;
}

// ── Site form ────────────────────────────────────────────────────────────────

const FALLBACK_COORDS = { latitude: 9.058, longitude: 7.5233 };

async function detectCoords(): Promise<typeof FALLBACK_COORDS> {
  if (typeof window === "undefined" || !navigator.geolocation)
    return FALLBACK_COORDS;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(FALLBACK_COORDS),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  unverified: {
    label: "Unverified",
    className: "bg-muted text-muted-foreground",
  },
  partially_verified: {
    label: "Partly Verified",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  verified: {
    label: "Verified",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  high_risk: {
    label: "High Risk",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  restricted: {
    label: "Restricted",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

interface SiteFormData {
  label: string;
  address: string;
  landmark_notes: string;
  tank_capacity_liters: string;
  has_gate: boolean;
  gate_notes: string;
}

const EMPTY_FORM: SiteFormData = {
  label: "",
  address: "",
  landmark_notes: "",
  tank_capacity_liters: "",
  has_gate: false,
  gate_notes: "",
};

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileDialog({
  open,
  user,
  onClose,
  onSaved,
}: ProfileDialogProps) {
  // Profile tab state
  const [name, setName] = useState(user.name ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [profileLoading, setProfileLoading] = useState(false);

  // Sites tab state
  const [sites, setSites] = useState<SiteProfileResponse[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [siteView, setSiteView] = useState<"list" | "form">("list");
  const [editingSite, setEditingSite] = useState<SiteProfileResponse | null>(
    null
  );
  const [form, setForm] = useState<SiteFormData>(EMPTY_FORM);
  const [savingSite, setSavingSite] = useState(false);

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const data = await listUserSites(user.id);
      setSites(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sites");
    } finally {
      setLoadingSites(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (open) {
      setName(user.name ?? "");
      setAddress(user.address ?? "");
      setSiteView("list");
      void loadSites();
    }
  }, [open, user.name, user.address, loadSites]);

  // Profile save
  const handleProfileSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!address.trim()) {
      toast.error("Address is required");
      return;
    }
    setProfileLoading(true);
    try {
      const updated = await updateUser(user.id, {
        name: name.trim(),
        address: address.trim(),
      });
      onSaved(updated);
      toast.success("Profile updated");
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile"
      );
    } finally {
      setProfileLoading(false);
    }
  };

  // Site helpers
  const openAddForm = () => {
    setEditingSite(null);
    setForm(EMPTY_FORM);
    setSiteView("form");
  };

  const openEditForm = (site: SiteProfileResponse) => {
    setEditingSite(site);
    setForm({
      label: site.label ?? "",
      address: site.address ?? "",
      landmark_notes: site.landmark_notes ?? "",
      tank_capacity_liters:
        site.tank_capacity_liters != null
          ? String(site.tank_capacity_liters)
          : "",
      has_gate: site.has_gate,
      gate_notes: site.gate_notes ?? "",
    });
    setSiteView("form");
  };

  const handleSiteSave = async () => {
    if (!form.label.trim()) {
      toast.error("Site label is required");
      return;
    }
    if (!form.address.trim()) {
      toast.error("Address is required");
      return;
    }

    const rawCapacity = form.tank_capacity_liters.trim();
    const tank_capacity = rawCapacity ? parseInt(rawCapacity, 10) : undefined;
    if (tank_capacity !== undefined && isNaN(tank_capacity)) {
      toast.error("Tank capacity must be a number");
      return;
    }

    const gateNotes =
      form.has_gate && form.gate_notes.trim()
        ? form.gate_notes.trim()
        : undefined;

    setSavingSite(true);
    try {
      if (editingSite) {
        const updated = await updateSite(editingSite.id, {
          label: form.label.trim(),
          address: form.address.trim(),
          landmark_notes: form.landmark_notes.trim() || undefined,
          tank_capacity_liters: tank_capacity,
          has_gate: form.has_gate,
          gate_notes: gateNotes,
        });
        setSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        toast.success("Site updated");
      } else {
        const coords = await detectCoords();
        const created = await createSite({
          user_id: user.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: form.label.trim(),
          address: form.address.trim(),
          landmark_notes: form.landmark_notes.trim() || undefined,
          tank_capacity_liters: tank_capacity,
          has_gate: form.has_gate,
          gate_notes: gateNotes,
        });
        setSites((prev) => [...prev, created]);
        toast.success("Site added");
      }
      setSiteView("list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save site");
    } finally {
      setSavingSite(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {siteView === "form" && (
              <button
                onClick={() => setSiteView("list")}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Back to sites list"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {siteView === "form"
              ? editingSite
                ? "Edit Site"
                : "Add New Site"
              : "Edit Profile"}
          </DialogTitle>
        </DialogHeader>

        {siteView === "form" ? (
          <SiteForm
            form={form}
            setForm={setForm}
            saving={savingSite}
            isEdit={!!editingSite}
            onSave={handleSiteSave}
            onCancel={() => setSiteView("list")}
          />
        ) : (
          <Tabs defaultValue="profile" className="pt-1">
            <TabsList className="w-full">
              <TabsTrigger value="profile" className="flex-1">
                Profile
              </TabsTrigger>
              <TabsTrigger value="sites" className="flex-1">
                My Sites
              </TabsTrigger>
            </TabsList>

            {/* Profile tab */}
            <TabsContent value="profile">
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Delivery Address</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Your delivery address"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={user.phone}
                    disabled
                    className="opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">
                    Phone number cannot be changed
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleProfileSave}
                    disabled={profileLoading}
                  >
                    {profileLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Sites tab */}
            <TabsContent value="sites">
              <div className="space-y-4 pt-2">
                {loadingSites ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : sites.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center">
                    <MapPin className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No delivery sites yet.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a site to speed up future orders.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {sites.map((site) => {
                      const meta =
                        STATUS_META[site.verification_status] ??
                        STATUS_META["unverified"];
                      return (
                        <div
                          key={site.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">
                                {site.label ?? "Unlabeled"}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
                              >
                                {meta.label}
                              </span>
                            </div>
                            {site.address && (
                              <p className="truncate text-xs text-muted-foreground">
                                {site.address}
                              </p>
                            )}
                            {site.tank_capacity_liters != null && (
                              <p className="text-xs text-muted-foreground">
                                Tank:{" "}
                                {site.tank_capacity_liters.toLocaleString()}L
                              </p>
                            )}
                            {site.delivery_count > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {site.delivery_count} deliver
                                {site.delivery_count !== 1 ? "ies" : "y"}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => openEditForm(site)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted"
                            aria-label={`Edit ${site.label ?? "site"}`}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button className="w-full" onClick={openAddForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Site
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Extracted site form to keep the main component readable ─────────────────

interface SiteFormProps {
  form: SiteFormData;
  setForm: React.Dispatch<React.SetStateAction<SiteFormData>>;
  saving: boolean;
  isEdit: boolean;
  onSave: () => void;
  onCancel: () => void;
}

function SiteForm({
  form,
  setForm,
  saving,
  isEdit,
  onSave,
  onCancel,
}: SiteFormProps) {
  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-1.5">
        <Label htmlFor="pd-site-label">Site Label</Label>
        <Input
          id="pd-site-label"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="Home, Office, Warehouse…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pd-site-address">Delivery Address</Label>
        <Textarea
          id="pd-site-address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="12 Gana St, Maitama, Abuja"
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pd-site-landmark">
          Landmark / Notes{" "}
          <span className="text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        </Label>
        <Input
          id="pd-site-landmark"
          value={form.landmark_notes}
          onChange={(e) =>
            setForm((f) => ({ ...f, landmark_notes: e.target.value }))
          }
          placeholder="Blue gate, beside the school"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pd-site-tank">
          Tank Capacity (liters){" "}
          <span className="text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        </Label>
        <Input
          id="pd-site-tank"
          type="number"
          min="0"
          value={form.tank_capacity_liters}
          onChange={(e) =>
            setForm((f) => ({ ...f, tank_capacity_liters: e.target.value }))
          }
          placeholder="e.g. 5000"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
        <Label htmlFor="pd-site-gate" className="cursor-pointer">
          Has gate / barrier?
        </Label>
        <Switch
          id="pd-site-gate"
          checked={form.has_gate}
          onCheckedChange={(v) =>
            setForm((f) => ({ ...f, has_gate: v, gate_notes: v ? f.gate_notes : "" }))
          }
        />
      </div>

      {form.has_gate && (
        <div className="space-y-1.5">
          <Label htmlFor="pd-site-gate-notes">
            Gate Notes{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="pd-site-gate-notes"
            value={form.gate_notes}
            onChange={(e) =>
              setForm((f) => ({ ...f, gate_notes: e.target.value }))
            }
            placeholder="Call ahead, code is 1234…"
          />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEdit ? (
            "Save Changes"
          ) : (
            "Add Site"
          )}
        </Button>
      </div>
    </div>
  );
}
