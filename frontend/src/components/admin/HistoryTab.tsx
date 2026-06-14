import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, RefreshCw } from "lucide-react";
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

const POLL_MS = 300_000;
const PAGE_SIZE = 25;

const REQUEST_STATUSES = [
  "pending", "searching_driver", "assigned", "loading", "delivering",
  "arrived", "completed", "partially_completed", "failed", "expired",
  "assignment_failed", "cancelled",
];

const DELIVERY_STATUSES = [
  "pending", "en_route", "arrived", "measuring", "awaiting_otp",
  "delivered", "failed", "skipped",
];

const filterSelectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
  const [requestFromDate, setRequestFromDate] = useState("");
  const [requestToDate, setRequestToDate] = useState("");
  const [requestPage, setRequestPage] = useState(0);

  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryType, setDeliveryType] = useState("");
  const [deliveryFromDate, setDeliveryFromDate] = useState("");
  const [deliveryToDate, setDeliveryToDate] = useState("");
  const [deliveryPage, setDeliveryPage] = useState(0);

  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["admin", "requests", requestSearch, requestStatus, requestType, requestFromDate, requestToDate, requestPage],
    queryFn: () =>
      getAdminRequests({
        limit: PAGE_SIZE,
        offset: requestPage * PAGE_SIZE,
        search: requestSearch,
        status: requestStatus || undefined,
        deliveryType: requestType || undefined,
        fromDate: requestFromDate || undefined,
        toDate: requestToDate || undefined,
      }),
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const deliveriesQuery = useQuery({
    queryKey: ["admin", "deliveries", deliverySearch, deliveryStatus, deliveryType, deliveryFromDate, deliveryToDate, deliveryPage],
    queryFn: () =>
      getAdminDeliveries({
        limit: PAGE_SIZE,
        offset: deliveryPage * PAGE_SIZE,
        search: deliverySearch,
        status: deliveryStatus || undefined,
        jobType: deliveryType || undefined,
        fromDate: deliveryFromDate || undefined,
        toDate: deliveryToDate || undefined,
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
  const requestTotal = requestsQuery.data?.total ?? 0;
  const requestTotalPages = Math.max(1, Math.ceil(requestTotal / PAGE_SIZE));

  const deliveries = deliveriesQuery.data?.items || [];
  const deliveryTotal = deliveriesQuery.data?.total ?? 0;
  const deliveryTotalPages = Math.max(1, Math.ceil(deliveryTotal / PAGE_SIZE));

  return (
    <div className="space-y-8">
      {/* Order history */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Order history log</h2>
            <p className="text-sm text-muted-foreground">
              Tabular request log with drill-down. Includes batch and priority orders.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => requestsQuery.refetch()}
            disabled={requestsQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${requestsQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Input
            value={requestSearch}
            onChange={(e) => { setRequestSearch(e.target.value); setRequestPage(0); }}
            placeholder="Search request / user"
          />
          <select
            value={requestStatus}
            onChange={(e) => { setRequestStatus(e.target.value); setRequestPage(0); }}
            className={filterSelectCls}
          >
            <option value="">All statuses</option>
            {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={requestType}
            onChange={(e) => { setRequestType(e.target.value); setRequestPage(0); }}
            className={filterSelectCls}
          >
            <option value="">All types</option>
            <option value="batch">batch</option>
            <option value="priority">priority</option>
          </select>
          <input
            type="date"
            value={requestFromDate}
            onChange={(e) => { setRequestFromDate(e.target.value); setRequestPage(0); }}
            className={filterSelectCls}
          />
          <input
            type="date"
            value={requestToDate}
            onChange={(e) => { setRequestToDate(e.target.value); setRequestPage(0); }}
            className={filterSelectCls}
          />
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
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">
            {requestTotal} total • Page {requestPage + 1} of {requestTotalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={requestPage === 0}
              onClick={() => setRequestPage((p) => p - 1)}
            >
              ← Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={requestPage >= requestTotalPages - 1}
              onClick={() => setRequestPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      </section>

      {/* Delivery history */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Delivery history log</h2>
            <p className="text-sm text-muted-foreground">
              Stop-level truth table. Unresolved deliveries can be completed, failed, or skipped.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deliveriesQuery.refetch()}
            disabled={deliveriesQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${deliveriesQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Input
            value={deliverySearch}
            onChange={(e) => { setDeliverySearch(e.target.value); setDeliveryPage(0); }}
            placeholder="Search delivery / batch / tanker"
          />
          <select
            value={deliveryStatus}
            onChange={(e) => { setDeliveryStatus(e.target.value); setDeliveryPage(0); }}
            className={filterSelectCls}
          >
            <option value="">All statuses</option>
            {DELIVERY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={deliveryType}
            onChange={(e) => { setDeliveryType(e.target.value); setDeliveryPage(0); }}
            className={filterSelectCls}
          >
            <option value="">All types</option>
            <option value="batch">batch</option>
            <option value="priority">priority</option>
          </select>
          <input
            type="date"
            value={deliveryFromDate}
            onChange={(e) => { setDeliveryFromDate(e.target.value); setDeliveryPage(0); }}
            className={filterSelectCls}
          />
          <input
            type="date"
            value={deliveryToDate}
            onChange={(e) => { setDeliveryToDate(e.target.value); setDeliveryPage(0); }}
            className={filterSelectCls}
          />
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
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">
            {deliveryTotal} total • Page {deliveryPage + 1} of {deliveryTotalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={deliveryPage === 0}
              onClick={() => setDeliveryPage((p) => p - 1)}
            >
              ← Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={deliveryPage >= deliveryTotalPages - 1}
              onClick={() => setDeliveryPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
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
