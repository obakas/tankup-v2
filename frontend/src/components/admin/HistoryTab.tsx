import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatNigeriaDateTime } from "@/lib/datetime";
import {
  adminManualCompleteDelivery,
  getAdminDeliveries,
  getAdminRequestDetail,
  getAdminRequests,
  type AdminDeliveryCard,
} from "@/lib/admin";
import { formatNumber, StatusPill } from "./shared";

const POLL_MS = 30_000;

type AskConfirm = (title: string, description: string, action: () => Promise<unknown>) => void;

type Props = {
  canLoad: boolean;
  isActionLoading: boolean;
  askConfirm: AskConfirm;
  onOpenReasonModal: (type: "fail" | "skip", delivery: AdminDeliveryCard) => void;
};

export function HistoryTab({ canLoad, isActionLoading, askConfirm, onOpenReasonModal }: Props) {
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [requestType, setRequestType] = useState("");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryType, setDeliveryType] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["admin", "requests", requestSearch, requestStatus, requestType],
    queryFn: () =>
      getAdminRequests({
        limit: 100,
        search: requestSearch,
        status: requestStatus || undefined,
        deliveryType: requestType || undefined,
      }),
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const deliveriesQuery = useQuery({
    queryKey: ["admin", "deliveries", deliverySearch, deliveryStatus, deliveryType],
    queryFn: () =>
      getAdminDeliveries({
        limit: 100,
        search: deliverySearch,
        status: deliveryStatus || undefined,
        jobType: deliveryType || undefined,
      }),
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const requestDetailQuery = useQuery({
    queryKey: ["admin", "request-detail", selectedRequestId],
    queryFn: () => getAdminRequestDetail(selectedRequestId as number),
    enabled: canLoad && selectedRequestId !== null,
  });

  const requests = requestsQuery.data?.items || [];
  const deliveries = deliveriesQuery.data?.items || [];

  return (
    <div className="space-y-8">
      {/* Order history */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Order history log</h2>
            <p className="text-sm text-muted-foreground">
              Tabular request log with drill-down. Includes batch and priority orders.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[640px]">
            <Input
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              placeholder="Search request / user"
            />
            <Input
              value={requestStatus}
              onChange={(e) => setRequestStatus(e.target.value)}
              placeholder="Status filter"
            />
            <Input
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              placeholder="batch / priority"
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Retry</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                    No requests found.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>#{item.id}</TableCell>
                    <TableCell className="capitalize">{item.delivery_type}</TableCell>
                    <TableCell>
                      <StatusPill status={item.status} />
                    </TableCell>
                    <TableCell>#{item.user_id}</TableCell>
                    <TableCell>{formatNumber(item.volume_liters)}L</TableCell>
                    <TableCell>{item.retry_count}</TableCell>
                    <TableCell>{formatNigeriaDateTime(item.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRequestId(item.id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Delivery history */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Delivery history log</h2>
            <p className="text-sm text-muted-foreground">
              Stop-level truth table. Unresolved deliveries can be completed, failed, or skipped.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[640px]">
            <Input
              value={deliverySearch}
              onChange={(e) => setDeliverySearch(e.target.value)}
              placeholder="Search delivery / batch / tanker"
            />
            <Input
              value={deliveryStatus}
              onChange={(e) => setDeliveryStatus(e.target.value)}
              placeholder="Status filter"
            />
            <Input
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value)}
              placeholder="batch / priority"
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanker</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Planned</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                    No deliveries found.
                  </TableCell>
                </TableRow>
              ) : (
                deliveries.map((item) => (
                  <DeliveryRow
                    key={item.id}
                    item={item}
                    isActionLoading={isActionLoading}
                    askConfirm={askConfirm}
                    onOpenReasonModal={onOpenReasonModal}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Request detail sheet */}
      <Sheet
        open={selectedRequestId !== null}
        onOpenChange={(open) => !open && setSelectedRequestId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Request detail</SheetTitle>
            <SheetDescription>
              Customer, payments, batch link, tanker, and delivery trail.
            </SheetDescription>
          </SheetHeader>
          <RequestDetail data={requestDetailQuery.data} isLoading={requestDetailQuery.isLoading} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Delivery row ──────────────────────────────────────────────────────────────

function DeliveryRow({
  item,
  isActionLoading,
  askConfirm,
  onOpenReasonModal,
}: {
  item: AdminDeliveryCard;
  isActionLoading: boolean;
  askConfirm: AskConfirm;
  onOpenReasonModal: (type: "fail" | "skip", delivery: AdminDeliveryCard) => void;
}) {
  const resolved = ["delivered", "failed", "skipped"].includes(item.delivery_status);

  return (
    <TableRow>
      <TableCell>#{item.id}</TableCell>
      <TableCell className="capitalize">{item.job_type}</TableCell>
      <TableCell>
        <StatusPill status={item.delivery_status} />
      </TableCell>
      <TableCell>#{item.tanker_id}</TableCell>
      <TableCell>{item.user_name || `#${item.user_id ?? "—"}`}</TableCell>
      <TableCell>{formatNumber(item.planned_liters)}L</TableCell>
      <TableCell>{formatNigeriaDateTime(item.updated_at)}</TableCell>
      <TableCell>
        {resolved ? (
          <span className="text-xs text-muted-foreground">Resolved</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isActionLoading}
              onClick={() =>
                askConfirm(
                  "Complete delivery",
                  `Force delivery #${item.id} to delivered. Bypasses missing OTP/measurement if necessary.`,
                  () => adminManualCompleteDelivery(item.id, { notes: "Manual admin completion" }),
                )
              }
            >
              Complete
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isActionLoading}
              onClick={() => onOpenReasonModal("fail", item)}
            >
              Fail
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isActionLoading}
              onClick={() => onOpenReasonModal("skip", item)}
            >
              Skip
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

// ── Request detail sheet content ──────────────────────────────────────────────

function RequestDetail({
  data,
  isLoading,
}: {
  data: ReturnType<typeof getAdminRequestDetail> extends Promise<infer T> ? T : never;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading request detail…</p>;
  }
  if (!data) return null;

  return (
    <div className="mt-6 space-y-4">
      <DetailCard title={`Request #${data.request.id}`} status={data.request.status}>
        <p className="text-sm text-muted-foreground">
          {data.request.delivery_type} • {formatNumber(data.request.volume_liters)}L • User #
          {data.request.user_id}
        </p>
        <p className="text-sm text-muted-foreground">
          Created: {formatNigeriaDateTime(data.request.created_at)}
        </p>
      </DetailCard>

      {data.user && (
        <DetailCard title="Customer">
          <p className="text-sm text-muted-foreground">
            {data.user.name} • {data.user.phone}
          </p>
          <p className="text-sm text-muted-foreground">{data.user.address}</p>
        </DetailCard>
      )}

      {data.member && (
        <DetailCard title="Batch member">
          <p className="text-sm text-muted-foreground">
            Member #{data.member.id} • Status: {data.member.status || "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            Payment: {data.member.payment_status || "—"} • Amount: ₦
            {formatNumber(data.member.amount_paid)}
          </p>
        </DetailCard>
      )}

      {data.batch && (
        <DetailCard title="Batch">
          <p className="text-sm text-muted-foreground">
            Batch #{data.batch.id} • {data.batch.fill_percent}% full • Tanker{" "}
            {data.batch.tanker_id ? `#${data.batch.tanker_id}` : "Unassigned"}
          </p>
        </DetailCard>
      )}

      {data.tanker && (
        <DetailCard title="Tanker">
          <p className="text-sm text-muted-foreground">
            {data.tanker.driver_name} • {data.tanker.tank_plate_number}
          </p>
          <p className="text-sm text-muted-foreground">Status: {data.tanker.status}</p>
        </DetailCard>
      )}

      <div className="rounded-xl border p-4 space-y-3">
        <p className="font-semibold text-foreground">Payments</p>
        {data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked payments.</p>
        ) : (
          data.payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <p className="text-sm text-muted-foreground">Payment #{payment.id}</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">
                  ₦{formatNumber(payment.amount)}
                </span>
                <StatusPill status={payment.status} />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <p className="font-semibold text-foreground">Delivery trail</p>
        {data.deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked delivery records.</p>
        ) : (
          data.deliveries.map((delivery) => (
            <div key={delivery.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">Delivery #{delivery.id}</p>
                <StatusPill status={delivery.delivery_status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Stop {delivery.stop_order ?? "—"} • Tanker #{delivery.tanker_id} • Planned{" "}
                {formatNumber(delivery.planned_liters)}L
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DetailCard({
  title,
  status,
  children,
}: {
  title: string;
  status?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        {status && <StatusPill status={status} />}
      </div>
      {children}
    </div>
  );
}
