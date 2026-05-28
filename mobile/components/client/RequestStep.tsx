import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Droplets, MapPin, Plus, Users, Zap, XCircle, CalendarClock } from "lucide-react-native";

import {
  TANK_SIZES,
  BATCH_PRICE_PER_LITER,
  PRIORITY_PRICE_PER_LITER,
} from "@/constants/water";

import type { RequestMode, PriorityMode } from "@/types/client";
import type { SiteProfileResponse } from "@/lib/api";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  mode: RequestMode;
  setMode: (m: RequestMode) => void;

  size: number | null;
  setSize: (n: number) => void;

  priorityMode: PriorityMode;
  setPriorityMode: (p: PriorityMode) => void;

  scheduledFor: string;
  setScheduledFor: (value: string) => void;

  userSites: SiteProfileResponse[];
  selectedSiteId: number | null;
  loadingSites: boolean;
  onSelectSite: (siteId: number) => void;
  onAddSite: () => void;

  onContinue: () => void;
  onCancel?: () => void;

  loading: boolean;
};

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatPrettyDateTime(value: string) {
  if (!value) return "Not selected";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not selected";

  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RequestStep({
  mode,
  setMode,
  size,
  setSize,
  priorityMode,
  setPriorityMode,
  scheduledFor,
  setScheduledFor,
  userSites,
  selectedSiteId,
  loadingSites,
  onSelectSite,
  onAddSite,
  onContinue,
  onCancel,
  loading,
}: Props) {
  const { theme } = useAppTheme();
  const text = { color: theme.foreground };
  const mutedText = { color: theme.mutedForeground };
  const cardStyle = { backgroundColor: theme.card, borderColor: theme.border };
  const surfaceStyle = { backgroundColor: theme.cardSoft, borderColor: theme.border };

  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");

  const selectedDate = useMemo(() => {
    if (!scheduledFor) {
      const fallback = new Date();
      fallback.setHours(fallback.getHours() + 2);
      fallback.setMinutes(0);
      fallback.setSeconds(0);
      fallback.setMilliseconds(0);
      return fallback;
    }

    const parsed = new Date(scheduledFor);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [scheduledFor]);

  const minimumDate = useMemo(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    return date;
  }, []);

  const price =
    (size ?? 0) *
    (mode === "batch" ? BATCH_PRICE_PER_LITER : PRIORITY_PRICE_PER_LITER);

  const canContinue =
    !!size &&
    !!selectedSiteId &&
    !loading &&
    (mode === "batch" || priorityMode === "asap" || !!scheduledFor);

  const openPicker = (type: "date" | "time") => {
    setPickerMode(type);
    setShowPicker(true);
  };

  const handleDateChange = (_event: unknown, date?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (!date) return;

    const nextDate = new Date(selectedDate);

    if (pickerMode === "date") {
      nextDate.setFullYear(date.getFullYear());
      nextDate.setMonth(date.getMonth());
      nextDate.setDate(date.getDate());
    } else {
      nextDate.setHours(date.getHours());
      nextDate.setMinutes(date.getMinutes());
    }

    setScheduledFor(toLocalInputValue(nextDate));
  };

  return (
    <View className="gap-6">
      <View className="items-center py-4">
        <View style={{ backgroundColor: theme.primarySoft }} className="w-16 h-16 rounded-2xl items-center justify-center mb-3">
          <Droplets size={34} color={theme.primary} />
        </View>

        <Text style={text} className="text-xl font-bold text-center">
          Choose your delivery option
        </Text>

        <Text style={mutedText} className="text-sm mt-1 text-center">
          Pick the plan that works best for you
        </Text>
      </View>

      <View className="gap-3">
        <Pressable
          onPress={() => setMode("batch")}
          style={{ backgroundColor: mode === "batch" ? theme.primarySoft : theme.card, borderColor: mode === "batch" ? theme.primary : theme.border }}
          className="rounded-xl border-2 p-4"
        >
          <View className="flex-row gap-3 items-start">
            <View style={{ backgroundColor: theme.primarySoft }} className="w-11 h-11 rounded-xl items-center justify-center">
              <Users size={22} color={theme.primary} />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text style={text} className="font-semibold">
                  Batch Saver
                </Text>

                <View style={{ backgroundColor: theme.primarySoft }} className="px-2 py-1 rounded-full">
                  <Text className="text-primary text-xs font-medium">
                    Lower Cost
                  </Text>
                </View>
              </View>

              <Text style={mutedText} className="text-sm mt-1">
                Join nearby customers and pay less. Delivery starts when the
                batch is filled.
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setMode("priority")}
          style={{ backgroundColor: mode === "priority" ? theme.warningSoft : theme.card, borderColor: mode === "priority" ? theme.warning : theme.border }}
          className="rounded-xl border-2 p-4"
        >
          <View className="flex-row gap-3 items-start">
            <View style={{ backgroundColor: theme.warningSoft }} className="w-11 h-11 rounded-xl items-center justify-center">
              <Zap size={22} color={theme.warning} />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text style={text} className="font-semibold">
                  Priority Delivery
                </Text>

                <View style={{ backgroundColor: theme.warningSoft }} className="px-2 py-1 rounded-full">
                  <Text className="text-warning text-xs font-medium">
                    Premium
                  </Text>
                </View>
              </View>

              <Text style={mutedText} className="text-sm mt-1">
                Faster delivery with ASAP dispatch or a scheduled time.
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      {mode === "priority" && (
        <View style={cardStyle} className="rounded-xl border p-5 gap-4">
          <View>
            <Text style={text} className="font-semibold">
              Choose delivery timing
            </Text>
            <Text style={mutedText} className="text-sm mt-1">
              Select ASAP or schedule a realistic delivery window.
            </Text>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                setPriorityMode("asap");
                setScheduledFor("");
              }}
              style={{ backgroundColor: priorityMode === "asap" ? theme.warningSoft : theme.background, borderColor: priorityMode === "asap" ? theme.warning : theme.border }}
              className="flex-1 rounded-lg border p-3"
            >
              <Text style={text} className="font-medium">ASAP</Text>
              <Text style={mutedText} className="text-xs mt-1">
                Earliest realistic dispatch.
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPriorityMode("scheduled")}
              style={{ backgroundColor: priorityMode === "scheduled" ? theme.warningSoft : theme.background, borderColor: priorityMode === "scheduled" ? theme.warning : theme.border }}
              className="flex-1 rounded-lg border p-3"
            >
              <Text style={text} className="font-medium">Schedule</Text>
              <Text style={mutedText} className="text-xs mt-1">
                Pick date and time.
              </Text>
            </Pressable>
          </View>

          {priorityMode === "scheduled" && (
            <View style={{ backgroundColor: theme.background, borderColor: theme.border }} className="rounded-xl border p-4 gap-3">
              <View className="flex-row items-center gap-2">
                <CalendarClock size={18} color={theme.primary} />
                <Text style={text} className="font-semibold">
                  {formatPrettyDateTime(scheduledFor)}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => openPicker("date")}
                  style={cardStyle} className="flex-1 rounded-lg border py-3 items-center"
                >
                  <Text style={text} className="font-medium">
                    Choose Date
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openPicker("time")}
                  style={cardStyle} className="flex-1 rounded-lg border py-3 items-center"
                >
                  <Text style={text} className="font-medium">
                    Choose Time
                  </Text>
                </Pressable>
              </View>

              {showPicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode={pickerMode}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={minimumDate}
                  onChange={handleDateChange}
                />
              )}

              <Text style={mutedText} className="text-xs">
                Give the tanker enough room for loading and movement. No magic
                carpet logistics here.
              </Text>
            </View>
          )}
        </View>
      )}

      <View>
        <Text style={text} className="font-semibold">
          How much water do you need?
        </Text>
        <Text style={mutedText} className="text-sm mt-1 mb-3">
          Select your tank size
        </Text>

        <View className="flex-row flex-wrap gap-3">
          {TANK_SIZES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSize(s)}
              style={{ backgroundColor: size === s ? theme.primarySoft : theme.card, borderColor: size === s ? theme.primary : theme.border }}
              className="w-[47%] rounded-xl border-2 p-4 items-center"
            >
              <Text style={text} className="text-2xl font-bold">
                {Number(s / 1000).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                k
              </Text>

              <Text style={mutedText} className="text-xs mt-1">
                {s.toLocaleString()} Liters
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text style={text} className="font-semibold">Delivery site</Text>
            <Text style={mutedText} className="text-sm mt-1">
              Where should we deliver the water?
            </Text>
          </View>
          <Pressable
            onPress={onAddSite}
            className="flex-row items-center gap-1"
          >
            <Plus size={14} color={theme.primary} />
            <Text style={{ color: theme.primary }} className="text-sm">
              Add site
            </Text>
          </Pressable>
        </View>

        {loadingSites ? (
          <View className="items-center py-6">
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : userSites.length === 0 ? (
          <Pressable
            onPress={onAddSite}
            style={{ borderColor: theme.border }}
            className="rounded-xl border-2 border-dashed p-5 items-center gap-2"
          >
            <MapPin size={24} color={theme.mutedForeground} />
            <Text style={mutedText} className="text-sm">No sites saved yet.</Text>
            <Text style={{ color: theme.primary }} className="text-sm">
              Add your first delivery site
            </Text>
          </Pressable>
        ) : (
          <View className="gap-2">
            {userSites.map((site) => (
              <Pressable
                key={site.id}
                onPress={() => onSelectSite(site.id)}
                style={{
                  backgroundColor: selectedSiteId === site.id ? theme.primarySoft : theme.card,
                  borderColor: selectedSiteId === site.id ? theme.primary : theme.border,
                }}
                className="rounded-xl border-2 p-3 flex-row gap-3 items-start"
              >
                <View
                  style={{ backgroundColor: theme.primarySoft }}
                  className="w-8 h-8 rounded-lg items-center justify-center mt-0.5"
                >
                  <MapPin size={16} color={theme.primary} />
                </View>
                <View className="flex-1">
                  <Text style={text} className="text-sm font-medium" numberOfLines={1}>
                    {site.label ?? "Unnamed site"}
                  </Text>
                  {!!site.address && (
                    <Text style={mutedText} className="text-xs mt-0.5" numberOfLines={1}>
                      {site.address}
                    </Text>
                  )}
                  {site.tank_capacity_liters != null && (
                    <Text style={mutedText} className="text-xs mt-0.5">
                      Tank: {site.tank_capacity_liters.toLocaleString()}L
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {size && (
        <View style={cardStyle} className="rounded-xl border p-5 gap-3">
          <View className="flex-row justify-between">
            <Text style={mutedText} className="text-sm">Delivery type</Text>
            <Text style={text} className="text-sm font-medium">
              {mode === "batch" ? "Batch Saver" : "Priority Delivery"}
            </Text>
          </View>

          {selectedSiteId && (
            <View className="flex-row justify-between">
              <Text style={mutedText} className="text-sm">Delivery site</Text>
              <Text style={text} className="text-sm font-medium" numberOfLines={1}>
                {userSites.find((s) => s.id === selectedSiteId)?.label ?? "Selected site"}
              </Text>
            </View>
          )}

          {mode === "priority" && (
            <View className="flex-row justify-between">
              <Text style={mutedText} className="text-sm">
                Priority timing
              </Text>
              <Text style={text} className="text-sm font-medium">
                {priorityMode === "asap"
                  ? "ASAP"
                  : formatPrettyDateTime(scheduledFor)}
              </Text>
            </View>
          )}

          <View className="flex-row justify-between">
            <Text style={mutedText} className="text-sm">Water quantity</Text>
            <Text style={text} className="text-sm font-medium">
              {size.toLocaleString()}L
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text style={mutedText} className="text-sm">Rate</Text>
            <Text style={text} className="text-sm font-medium">
              ₦
              {mode === "batch"
                ? BATCH_PRICE_PER_LITER
                : PRIORITY_PRICE_PER_LITER}
              /liter
            </Text>
          </View>

          <View style={{ borderTopColor: theme.border }} className="border-t pt-3 flex-row justify-between items-center">
            <Text style={text} className="font-semibold">Total</Text>
            <Text style={text} className="text-xl font-bold">
              ₦{price.toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      <View className="gap-3">
        <Pressable
          disabled={!canContinue}
          onPress={onContinue}
          style={{ backgroundColor: canContinue ? theme.primary : theme.border }}
          className="rounded-xl py-4 items-center"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {!size
                ? "Select a tank size"
                : !selectedSiteId
                  ? "Select a delivery site"
                  : "Continue to Payment"}
            </Text>
          )}
        </Pressable>

        {onCancel && (
          <Pressable
            onPress={onCancel}
            style={cardStyle} className="rounded-xl py-4 items-center border flex-row justify-center gap-2"
          >
            <XCircle size={18} color={theme.destructive} />
            <Text style={text} className="font-semibold">
              Cancel Request
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// import { useMemo, useState } from "react";
// import {
//   View,
//   Text,
//   Pressable,
//   ActivityIndicator,
//   Platform,
// } from "react-native";
// import DateTimePicker from "@react-native-community/datetimepicker";
// import { Droplets, Users, Zap, XCircle, CalendarClock } from "lucide-react-native";

// import {
//   TANK_SIZES,
//   BATCH_PRICE_PER_LITER,
//   PRIORITY_PRICE_PER_LITER,
// } from "@/constants/water";

// import type { RequestMode, PriorityMode } from "@/types/client";

// type Props = {
//   mode: RequestMode;
//   setMode: (m: RequestMode) => void;

//   size: number | null;
//   setSize: (n: number) => void;

//   priorityMode: PriorityMode;
//   setPriorityMode: (p: PriorityMode) => void;

//   scheduledFor: string;
//   setScheduledFor: (value: string) => void;

//   onContinue: () => void;
//   onCancel?: () => void;

//   loading: boolean;
// };

// function toLocalInputValue(date: Date) {
//   const pad = (n: number) => String(n).padStart(2, "0");

//   return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
//     date.getDate()
//   )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
// }

// function formatPrettyDateTime(value: string) {
//   if (!value) return "Not selected";

//   const date = new Date(value);

//   if (Number.isNaN(date.getTime())) return "Not selected";

//   return date.toLocaleString(undefined, {
//     weekday: "short",
//     month: "short",
//     day: "numeric",
//     hour: "numeric",
//     minute: "2-digit",
//   });
// }

// export function RequestStep({
//   mode,
//   setMode,
//   size,
//   setSize,
//   priorityMode,
//   setPriorityMode,
//   scheduledFor,
//   setScheduledFor,
//   onContinue,
//   onCancel,
//   loading,
// }: Props) {
//   const [showPicker, setShowPicker] = useState(false);
//   const [pickerMode, setPickerMode] = useState<"date" | "time">("date");

//   const selectedDate = useMemo(() => {
//     if (!scheduledFor) {
//       const fallback = new Date();
//       fallback.setHours(fallback.getHours() + 2);
//       fallback.setMinutes(0);
//       fallback.setSeconds(0);
//       fallback.setMilliseconds(0);
//       return fallback;
//     }

//     const parsed = new Date(scheduledFor);
//     return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
//   }, [scheduledFor]);

//   const minimumDate = useMemo(() => {
//     const date = new Date();
//     date.setHours(date.getHours() + 1);
//     return date;
//   }, []);

//   const price =
//     (size ?? 0) *
//     (mode === "batch" ? BATCH_PRICE_PER_LITER : PRIORITY_PRICE_PER_LITER);

//   const canContinue =
//     !!size &&
//     !loading &&
//     (mode === "batch" || priorityMode === "asap" || !!scheduledFor);

//   const openPicker = (type: "date" | "time") => {
//     setPickerMode(type);
//     setShowPicker(true);
//   };

//   const handleDateChange = (_event: unknown, date?: Date) => {
//     if (Platform.OS === "android") {
//       setShowPicker(false);
//     }

//     if (!date) return;

//     const nextDate = new Date(selectedDate);

//     if (pickerMode === "date") {
//       nextDate.setFullYear(date.getFullYear());
//       nextDate.setMonth(date.getMonth());
//       nextDate.setDate(date.getDate());
//     } else {
//       nextDate.setHours(date.getHours());
//       nextDate.setMinutes(date.getMinutes());
//     }

//     setScheduledFor(toLocalInputValue(nextDate));
//   };

//   return (
//     <View className="gap-6">
//       <View className="items-center py-4">
//         <View className="w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center mb-3">
//           <Droplets size={34} color={theme.primary} />
//         </View>

//         <Text className="text-foreground text-xl font-bold text-center">
//           Choose your delivery option
//         </Text>

//         <Text className="text-muted-foreground text-sm mt-1 text-center">
//           Pick the plan that works best for you
//         </Text>
//       </View>

//       <View className="gap-3">
//         <Pressable
//           onPress={() => setMode("batch")}
//           className={`rounded-xl border-2 p-4 ${
//             mode === "batch"
//               ? "border-primary bg-primary/10"
//               : "border-border bg-card"
//           }`}
//         >
//           <View className="flex-row gap-3 items-start">
//             <View className="w-11 h-11 rounded-xl bg-primary/10 items-center justify-center">
//               <Users size={22} color={theme.primary} />
//             </View>

//             <View className="flex-1">
//               <View className="flex-row items-center gap-2">
//                 <Text className="text-foreground font-semibold">
//                   Batch Saver
//                 </Text>

//                 <View className="px-2 py-1 rounded-full bg-primary/10">
//                   <Text className="text-primary text-xs font-medium">
//                     Lower Cost
//                   </Text>
//                 </View>
//               </View>

//               <Text className="text-muted-foreground text-sm mt-1">
//                 Join nearby customers and pay less. Delivery starts when the
//                 batch is filled.
//               </Text>
//             </View>
//           </View>
//         </Pressable>

//         <Pressable
//           onPress={() => setMode("priority")}
//           className={`rounded-xl border-2 p-4 ${
//             mode === "priority"
//               ? "border-warning bg-warning/10"
//               : "border-border bg-card"
//           }`}
//         >
//           <View className="flex-row gap-3 items-start">
//             <View className="w-11 h-11 rounded-xl bg-warning/10 items-center justify-center">
//               <Zap size={22} color={theme.warning} />
//             </View>

//             <View className="flex-1">
//               <View className="flex-row items-center gap-2">
//                 <Text className="text-foreground font-semibold">
//                   Priority Delivery
//                 </Text>

//                 <View className="px-2 py-1 rounded-full bg-warning/10">
//                   <Text className="text-warning text-xs font-medium">
//                     Premium
//                   </Text>
//                 </View>
//               </View>

//               <Text className="text-muted-foreground text-sm mt-1">
//                 Faster delivery with ASAP dispatch or a scheduled time.
//               </Text>
//             </View>
//           </View>
//         </Pressable>
//       </View>

//       {mode === "priority" && (
//         <View className="bg-card rounded-xl border border-border p-5 gap-4">
//           <View>
//             <Text className="text-foreground font-semibold">
//               Choose delivery timing
//             </Text>
//             <Text className="text-muted-foreground text-sm mt-1">
//               Select ASAP or schedule a realistic delivery window.
//             </Text>
//           </View>

//           <View className="flex-row gap-3">
//             <Pressable
//               onPress={() => {
//                 setPriorityMode("asap");
//                 setScheduledFor("");
//               }}
//               className={`flex-1 rounded-lg border p-3 ${
//                 priorityMode === "asap"
//                   ? "border-warning bg-warning/10"
//                   : "border-border bg-background"
//               }`}
//             >
//               <Text className="text-foreground font-medium">ASAP</Text>
//               <Text className="text-muted-foreground text-xs mt-1">
//                 Earliest realistic dispatch.
//               </Text>
//             </Pressable>

//             <Pressable
//               onPress={() => setPriorityMode("scheduled")}
//               className={`flex-1 rounded-lg border p-3 ${
//                 priorityMode === "scheduled"
//                   ? "border-warning bg-warning/10"
//                   : "border-border bg-background"
//               }`}
//             >
//               <Text className="text-foreground font-medium">Schedule</Text>
//               <Text className="text-muted-foreground text-xs mt-1">
//                 Pick date and time.
//               </Text>
//             </Pressable>
//           </View>

//           {priorityMode === "scheduled" && (
//             <View className="rounded-xl border border-border bg-background p-4 gap-3">
//               <View className="flex-row items-center gap-2">
//                 <CalendarClock size={18} color={theme.primary} />
//                 <Text className="text-foreground font-semibold">
//                   {formatPrettyDateTime(scheduledFor)}
//                 </Text>
//               </View>

//               <View className="flex-row gap-3">
//                 <Pressable
//                   onPress={() => openPicker("date")}
//                   className="flex-1 rounded-lg bg-card border border-border py-3 items-center"
//                 >
//                   <Text className="text-foreground font-medium">
//                     Choose Date
//                   </Text>
//                 </Pressable>

//                 <Pressable
//                   onPress={() => openPicker("time")}
//                   className="flex-1 rounded-lg bg-card border border-border py-3 items-center"
//                 >
//                   <Text className="text-foreground font-medium">
//                     Choose Time
//                   </Text>
//                 </Pressable>
//               </View>

//               {showPicker && (
//                 <DateTimePicker
//                   value={selectedDate}
//                   mode={pickerMode}
//                   display={Platform.OS === "ios" ? "spinner" : "default"}
//                   minimumDate={minimumDate}
//                   onChange={handleDateChange}
//                 />
//               )}

//               <Text className="text-muted-foreground text-xs">
//                 Give the tanker enough room for loading and movement. No magic
//                 carpet logistics here.
//               </Text>
//             </View>
//           )}
//         </View>
//       )}

//       <View>
//         <Text className="text-foreground font-semibold">
//           How much water do you need?
//         </Text>
//         <Text className="text-muted-foreground text-sm mt-1 mb-3">
//           Select your tank size
//         </Text>

//         <View className="flex-row flex-wrap gap-3">
//           {TANK_SIZES.map((s) => (
//             <Pressable
//               key={s}
//               onPress={() => setSize(s)}
//               className={`w-[47%] rounded-xl border-2 p-4 items-center ${
//                 size === s
//                   ? "border-primary bg-primary/10"
//                   : "border-border bg-card"
//               }`}
//             >
//               <Text className="text-foreground text-2xl font-bold">
//                 {Number(s / 1000).toLocaleString(undefined, {
//                   maximumFractionDigits: 1,
//                 })}
//                 k
//               </Text>

//               <Text className="text-muted-foreground text-xs mt-1">
//                 {s.toLocaleString()} Liters
//               </Text>
//             </Pressable>
//           ))}
//         </View>
//       </View>

//       {size && (
//         <View className="bg-card rounded-xl border border-border p-5 gap-3">
//           <View className="flex-row justify-between">
//             <Text className="text-muted-foreground text-sm">Delivery type</Text>
//             <Text className="text-foreground text-sm font-medium">
//               {mode === "batch" ? "Batch Saver" : "Priority Delivery"}
//             </Text>
//           </View>

//           {mode === "priority" && (
//             <View className="flex-row justify-between">
//               <Text className="text-muted-foreground text-sm">
//                 Priority timing
//               </Text>
//               <Text className="text-foreground text-sm font-medium">
//                 {priorityMode === "asap"
//                   ? "ASAP"
//                   : formatPrettyDateTime(scheduledFor)}
//               </Text>
//             </View>
//           )}

//           <View className="flex-row justify-between">
//             <Text className="text-muted-foreground text-sm">Water quantity</Text>
//             <Text className="text-foreground text-sm font-medium">
//               {size.toLocaleString()}L
//             </Text>
//           </View>

//           <View className="flex-row justify-between">
//             <Text className="text-muted-foreground text-sm">Rate</Text>
//             <Text className="text-foreground text-sm font-medium">
//               ₦
//               {mode === "batch"
//                 ? BATCH_PRICE_PER_LITER
//                 : PRIORITY_PRICE_PER_LITER}
//               /liter
//             </Text>
//           </View>

//           <View className="border-t border-border pt-3 flex-row justify-between items-center">
//             <Text className="text-foreground font-semibold">Total</Text>
//             <Text className="text-foreground text-xl font-bold">
//               ₦{price.toLocaleString()}
//             </Text>
//           </View>
//         </View>
//       )}

//       <View className="gap-3">
//         <Pressable
//           disabled={!canContinue}
//           onPress={onContinue}
//           className={`rounded-xl py-4 items-center ${
//             canContinue ? "bg-primary" : "bg-border"
//           }`}
//         >
//           {loading ? (
//             <ActivityIndicator color="#fff" />
//           ) : (
//             <Text className="text-white font-semibold text-base">
//               {size ? "Continue to Payment" : "Select a tank size"}
//             </Text>
//           )}
//         </Pressable>

//         {onCancel && (
//           <Pressable
//             onPress={onCancel}
//             className="rounded-xl py-4 items-center border border-border bg-card flex-row justify-center gap-2"
//           >
//             <XCircle size={18} color={theme.destructive} />
//             <Text className="text-foreground font-semibold">
//               Cancel Request
//             </Text>
//           </Pressable>
//         )}
//       </View>
//     </View>
//   );
// }