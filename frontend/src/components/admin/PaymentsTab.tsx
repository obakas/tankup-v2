import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { adminRefundMember, adminResetTanker, getAdminPayments, getAdminTankers } from "@/lib/admin";
import { formatNumber, StatusPill } from "./shared";

const POLL_MS = 30_000;

type AskConfirm = (title: string, description: string, action: () => Promise<unknown>) => void;

type Props = {
  canLoad: boolean;
  isActionLoading: boolean;
  askConfirm: AskConfirm;
};

export function PaymentsTab({ canLoad, isActionLoading, askConfirm }: Props) {
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [tankerSearch, setTankerSearch] = useState("");
  const [tankerStatus, setTankerStatus] = useState("");

  const paymentsQuery = useQuery({
    queryKey: ["admin", "payments", paymentSearch, paymentStatus],
    queryFn: () =>
      getAdminPayments({
        limit: 100,
        search: paymentSearch,
        status: paymentStatus || undefined,
      }),
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const tankersQuery = useQuery({
    queryKey: ["admin", "tankers", tankerSearch, tankerStatus],
    queryFn: () =>
      getAdminTankers({
        limit: 100,
        search: tankerSearch,
        status: tankerStatus || undefined,
      }),
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const payments = paymentsQuery.data?.items || [];
  const tankers = tankersQuery.data?.items || [];

  return (
    <div className="space-y-8">
      {/* Payments */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Payments</h2>
            <p className="text-sm text-muted-foreground">
              Payment log with quick refund visibility.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[460px]">
            <Input
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              placeholder="Search payment / batch / member"
            />
            <Input
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              placeholder="Status filter"
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    No payments found.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>#{item.id}</TableCell>
                    <TableCell>
                      <StatusPill status={item.status} />
                    </TableCell>
                    <TableCell>#{item.user_id ?? "—"}</TableCell>
                    <TableCell>#{item.batch_id ?? "—"}</TableCell>
                    <TableCell>#{item.member_id ?? "—"}</TableCell>
                    <TableCell>₦{formatNumber(item.amount)}</TableCell>
                    <TableCell>
                      {item.member_id && item.status === "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isActionLoading}
                          onClick={() =>
                            askConfirm(
                              "Refund member",
                              `This will attempt a refund for batch member #${item.member_id}.`,
                              () => adminRefundMember(item.member_id as number),
                            )
                          }
                        >
                          Refund
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Tankers */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Tankers</h2>
            <p className="text-sm text-muted-foreground">
              Presence, state, and operational reset view.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[460px]">
            <Input
              value={tankerSearch}
              onChange={(e) => setTankerSearch(e.target.value)}
              placeholder="Search driver / phone / plate"
            />
            <Input
              value={tankerStatus}
              onChange={(e) => setTankerStatus(e.target.value)}
              placeholder="Status filter"
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Online</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tankers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    No tankers found.
                  </TableCell>
                </TableRow>
              ) : (
                tankers.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>#{item.id}</TableCell>
                    <TableCell>{item.driver_name}</TableCell>
                    <TableCell>
                      <StatusPill status={item.status} />
                    </TableCell>
                    <TableCell>{item.is_online ? "Yes" : "No"}</TableCell>
                    <TableCell>{item.is_available ? "Yes" : "No"}</TableCell>
                    <TableCell>{item.tank_plate_number}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isActionLoading}
                        onClick={() =>
                          askConfirm(
                            "Reset tanker",
                            `Clear pending offer/current assignment for tanker #${item.id} when possible.`,
                            () => adminResetTanker(item.id),
                          )
                        }
                      >
                        Reset
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
