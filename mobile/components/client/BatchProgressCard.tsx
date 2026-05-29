import { View, Text } from "react-native";
import { CreditCard, Droplets, Truck, Users } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { TankupTheme } from "@/components/ui/theme";

export type BatchProgressData = {
  batch_id?: number | string | null;
  status?: string | null;
  current_volume?: number | null;
  target_volume?: number | null;
  progress_percent?: number | null;
  fill_percentage?: number | null;
  member_count?: number | null;
  paid_member_count?: number | null;
  unpaid_member_count?: number | null;
  payment_ratio?: number | null;
  tanker_id?: number | string | null;
  tanker_status?: string | null;
  driver_name?: string | null;
  member_status?: string | null;
  member_payment_status?: string | null;
  refund_eligible?: boolean | null;
  refund_status?: string | null;
};

type Props = {
  batch?: BatchProgressData | null;
  requestedLiters?: number;
  amountPaid?: number;
};

function toNumber(value: unknown, fallback = 0) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function titleCase(value?: string | null) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLiters(value: number) {
  return `${Math.round(value).toLocaleString()}L`;
}

function MiniStat({ label, value, theme }: { label: string; value: string; theme: TankupTheme }) {
  return (
    <View
      className="flex-1 rounded-xl p-3"
      style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
    >
      <Text className="text-[11px] uppercase tracking-widest" style={{ color: theme.mutedForeground }}>{label}</Text>
      <Text className="mt-1 text-sm font-bold" style={{ color: theme.foreground }}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value, theme }: { label: string; value: string; theme: TankupTheme }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-2">
      <Text className="text-sm" style={{ color: theme.mutedForeground }}>{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold" style={{ color: theme.foreground }}>{value}</Text>
    </View>
  );
}

export function BatchProgressCard({ batch, requestedLiters = 0, amountPaid = 0 }: Props) {
  const { theme } = useAppTheme();
  const currentVolume = toNumber(batch?.current_volume, requestedLiters);
  const targetVolume = toNumber(batch?.target_volume, 12000);
  const fallbackProgress = targetVolume > 0 ? (currentVolume / targetVolume) * 100 : 0;
  const progress = clamp(
    toNumber(batch?.progress_percent ?? batch?.fill_percentage, fallbackProgress)
  );
  const remaining = Math.max(0, targetVolume - currentVolume);

  const memberCount = toNumber(batch?.member_count, currentVolume > 0 ? 1 : 0);
  const paidMembers = toNumber(batch?.paid_member_count, batch?.member_payment_status === "paid" ? memberCount : 0);
  const unpaidMembers = toNumber(batch?.unpaid_member_count, Math.max(0, memberCount - paidMembers));
  const paymentRatio = clamp(
    toNumber(batch?.payment_ratio, memberCount > 0 ? (paidMembers / memberCount) * 100 : 0)
  );

  void unpaidMembers;
  void paymentRatio;

  return (
    <View
      className="rounded-3xl p-5 shadow-sm"
      style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xl font-bold" style={{ color: theme.foreground }}>Batch Progress</Text>
          <Text className="mt-1 text-sm leading-5" style={{ color: theme.mutedForeground }}>
            Live view of how full this shared tanker batch is before dispatch.
          </Text>
        </View>
        <View className="rounded-2xl p-3" style={{ backgroundColor: theme.primarySoft }}>
          <Droplets color={theme.primary} size={22} />
        </View>
      </View>

      <View
        className="mt-5 rounded-2xl p-4"
        style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="flex-row items-end justify-between gap-4">
          <View>
            <Text className="text-xs uppercase tracking-widest" style={{ color: theme.mutedForeground }}>Filled</Text>
            <Text className="mt-1 text-4xl font-extrabold" style={{ color: theme.foreground }}>{Math.round(progress)}%</Text>
          </View>
          <Text className="text-right text-sm font-semibold" style={{ color: theme.mutedForeground }}>
            {formatLiters(currentVolume)} / {formatLiters(targetVolume)}
          </Text>
        </View>

        <View className="mt-4 h-3 overflow-hidden rounded-full" style={{ backgroundColor: theme.border }}>
          <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: theme.primary }} />
        </View>

        <Text className="mt-3 text-sm" style={{ color: theme.mutedForeground }}>
          {formatLiters(remaining)} remaining before this batch reaches target volume.
        </Text>
      </View>

      <View className="mt-4 flex-row gap-3">
        <MiniStat label="Members" value={memberCount ? String(memberCount) : "—"} theme={theme} />
        <MiniStat label="Paid" value={`${paidMembers}/${memberCount || "—"}`} theme={theme} />
      </View>

      <View className="mt-3 flex-row gap-3">
        {/* <MiniStat label="Payment Health" value={paymentRatio ? `${Math.round(paymentRatio)}%` : "—"} theme={theme} /> */}
        <MiniStat label="Amount" value={amountPaid ? `₦${amountPaid.toLocaleString()}` : "—"} theme={theme} />
      </View>

      <View
        className="mt-5 rounded-2xl p-4"
        style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="mb-2 flex-row items-center gap-2">
          <Truck color={theme.primary} size={17} />
          <Text className="font-bold" style={{ color: theme.foreground }}>Tanker Info</Text>
        </View>
        <InfoRow label="Assigned Tanker" value={batch?.tanker_id ? `#${batch.tanker_id}` : "Not assigned yet"} theme={theme} />
        <InfoRow label="Driver" value={batch?.driver_name ?? "—"} theme={theme} />
        <InfoRow label="Tanker Status" value={titleCase(batch?.tanker_status)} theme={theme} />
      </View>

      <View
        className="mt-4 rounded-2xl p-4"
        style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="mb-2 flex-row items-center gap-2">
          <Users color={theme.primary} size={17} />
          <Text className="font-bold" style={{ color: theme.foreground }}>Membership</Text>
        </View>
        <InfoRow label="Your Status" value={titleCase(batch?.member_status)} theme={theme} />
        <InfoRow label="Payment" value={titleCase(batch?.member_payment_status)} theme={theme} />
        {/* <InfoRow label="Unpaid Members" value={String(unpaidMembers || 0)} theme={theme} /> */}
      </View>

      <View
        className="mt-4 rounded-2xl p-4"
        style={{ backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border }}
      >
        <View className="mb-2 flex-row items-center gap-2">
          <CreditCard color={theme.primary} size={17} />
          <Text className="font-bold" style={{ color: theme.foreground }}>Refund</Text>
        </View>
        <InfoRow
          label="Refund Eligible"
          value={typeof batch?.refund_eligible === "boolean" ? (batch.refund_eligible ? "Yes" : "No") : "—"}
          theme={theme}
        />
        <InfoRow label="Refund Status" value={titleCase(batch?.refund_status)} theme={theme} />
      </View>
    </View>
  );
}
