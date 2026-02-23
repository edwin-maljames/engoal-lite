"use client";
import React from "react";

import Link from "next/link";
import { useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { useInvestments } from "@/hooks/use-investments";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { TableRowSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ASSET_CLASS_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/format-currency";
import { cn } from "@/lib/utils";

export default function InvestmentsPage(): React.JSX.Element {
  const [showInactive, setShowInactive] = useState(false);
  const { data, isLoading } = useInvestments(showInactive ? undefined : { is_active: true });

  const investments = data?.investments ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        description="All your investment instruments"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? "Hide inactive" : "Show inactive"}
            </Button>
            <Button asChild>
              <Link href="/investments/new">
                <Plus className="h-4 w-4" />
                New Investment
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <table className="w-full text-sm">
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => <TableRowSkeleton key={i} cols={7} />)}
              </tbody>
            </table>
          ) : investments.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No investments yet"
              description="Add your first investment to start tracking"
              action={
                <Button asChild>
                  <Link href="/investments/new">Add investment</Link>
                </Button>
              }
              className="m-6"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {["Name", "Asset Class", "Current Value", "Invested", "Gain/Loss", "CAGR", "Goals"].map((h) => (
                      <th key={h} className={cn(
                        "px-4 py-3 text-xs font-medium text-gray-500",
                        h === "Name" ? "text-left" : "text-right",
                        h === "Goals" && "text-left",
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => (
                    <tr key={inv.id} className={cn(
                      "border-b border-gray-50 last:border-0 hover:bg-gray-50",
                      !inv.is_active && "opacity-60",
                    )}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/investments/${inv.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {inv.name}
                        </Link>
                        {!inv.is_active && (
                          <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline">{ASSET_CLASS_LABELS[inv.asset_class]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ₹{formatINR(inv.latest_current_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">
                        ₹{formatINR(inv.latest_total_invested)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CurrencyDisplay
                          amount={inv.unrealized_gain}
                          showSign
                          className="text-sm"
                        />
                        <span className={cn(
                          "block text-xs",
                          inv.absolute_return_pct >= 0 ? "text-green-600" : "text-red-600",
                        )}>
                          {inv.absolute_return_pct >= 0 ? "+" : ""}
                          {inv.absolute_return_pct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {inv.expected_cagr}%
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                        {inv.linked_goals.map((g) => g.goal_name).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
