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
import { adminSetFleetHeadVerified, getAdminFleetHeads } from "@/lib/admin";
import { formatNigeriaTime } from "@/lib/datetime";
import { VerifiedBadge } from "./shared";

const POLL_MS = 30_000;

type AskConfirm = (title: string, description: string, action: () => Promise<unknown>) => void;

type Props = {
  canLoad: boolean;
  isActionLoading: boolean;
  askConfirm: AskConfirm;
};

export function FleetHeadsTab({ canLoad, isActionLoading, askConfirm }: Props) {
  const [search, setSearch] = useState("");

  const fleetHeadsQuery = useQuery({
    queryKey: ["admin", "fleet-heads", search],
    queryFn: () => getAdminFleetHeads({ limit: 100, search }),
    refetchInterval: POLL_MS,
    enabled: canLoad,
  });

  const fleetHeads = fleetHeadsQuery.data?.items || [];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Fleet Heads</h2>
            <p className="text-sm text-muted-foreground">
              Hub leads coordinating drivers, with field-verification status.
            </p>
          </div>
          <div className="lg:w-[280px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username / email"
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Hub</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fleetHeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    No fleet heads found.
                  </TableCell>
                </TableRow>
              ) : (
                fleetHeads.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>#{item.id}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        {item.username}
                        <VerifiedBadge verified={item.is_verified} />
                      </span>
                    </TableCell>
                    <TableCell>{item.email || "—"}</TableCell>
                    <TableCell>{item.hub_name || "—"}</TableCell>
                    <TableCell>{item.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell>{item.created_at ? formatNigeriaTime(item.created_at) : "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isActionLoading}
                        onClick={() =>
                          askConfirm(
                            item.is_verified ? "Unverify fleet head" : "Verify fleet head",
                            item.is_verified
                              ? `Remove verified status from fleet head #${item.id}.`
                              : `Mark fleet head #${item.id} as verified.`,
                            () => adminSetFleetHeadVerified(item.id, !item.is_verified),
                          )
                        }
                      >
                        {item.is_verified ? "Unverify" : "Verify"}
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
