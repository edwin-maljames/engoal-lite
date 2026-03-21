"use client";
import React from "react";

import { useDashboard } from "@/hooks/use-dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { AssetAllocationChart } from "@/components/charts/asset-allocation-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ASSET_CLASS_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/format-currency";
import { cn } from "@/lib/utils";

export default function AllocationPage(): React.JSX.Element {
  const { data: dashboard, isLoading } = useDashboard();
  const allocation = dashboard?.asset_allocation ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Allocation"
        description="How your portfolio is distributed across asset classes"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Allocation Chart</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 animate-pulse rounded bg-gray-100" />
            ) : allocation.length === 0 ? (
              <EmptyState title="No data yet" description="Add investments to see allocation" />
            ) : (
              <AssetAllocationChart data={allocation} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Allocation Table</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {["Asset Class", "# Investments", "Current Value", "Invested", "Gain/Loss", "Alloc %"].map((h) => (
                        <th key={h} className={cn("px-4 py-3 text-xs font-medium text-gray-500", h === "Asset Class" ? "text-left" : "text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allocation.map((item) => (
                      <tr key={item.asset_class} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3">
                          <Badge variant="outline">{ASSET_CLASS_LABELS[item.asset_class]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.investment_count}</td>
                        <td className="px-4 py-3 text-right font-mono">₹{formatINR(item.current_value)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">₹{formatINR(item.total_invested)}</td>
                        <td className="px-4 py-3 text-right">
                          <CurrencyDisplay amount={item.unrealized_gain} showSign className="text-sm" />
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{(item.allocation_pct ?? 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
