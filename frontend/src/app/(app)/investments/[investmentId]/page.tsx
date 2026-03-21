"use client";
import React from "react";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Edit, Archive, Plus } from "lucide-react";
import { useInvestment, useDeactivateInvestment } from "@/hooks/use-investments";
import { useEntries } from "@/hooks/use-entries";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ASSET_CLASS_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/format-currency";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface InvestmentDetailPageProps {
  params: Promise<{ investmentId: string }>;
}

export default function InvestmentDetailPage({ params }: InvestmentDetailPageProps): React.JSX.Element {
  const { investmentId } = use(params);
  const { data: investment, isLoading } = useInvestment(investmentId);
  const { data: entriesData } = useEntries(investmentId);
  const { mutateAsync: deactivate, isPending: isDeactivating } = useDeactivateInvestment();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!investment) {
    return <EmptyState title="Investment not found" action={<Button asChild><Link href="/investments">Back</Link></Button>} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/investments"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader
          title={investment.name}
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/investments/${investmentId}/edit`}>
                  <Edit className="h-4 w-4" /> Edit
                </Link>
              </Button>
              {investment.is_active && (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm" className="text-amber-600 border-amber-200">
                      <Archive className="h-4 w-4" /> Deactivate
                    </Button>
                  }
                  title="Deactivate investment?"
                  description={`This will hide "${investment.name}" from the monthly entry form. Historical data is preserved.`}
                  confirmLabel="Deactivate"
                  variant="default"
                  onConfirm={async () => { await deactivate(investmentId); }}
                  isLoading={isDeactivating}
                />
              )}
            </div>
          }
        />
      </div>

      {/* Header info */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Asset Class</p>
            <Badge variant="outline" className="mt-1">{ASSET_CLASS_LABELS[investment.asset_class]}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Current Value</p>
            <CurrencyDisplay amount={investment.latest_current_value ?? 0} className="mt-1 text-xl font-bold" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total Invested</p>
            <CurrencyDisplay amount={investment.latest_total_invested ?? 0} className="mt-1 text-xl font-bold" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Gain / Loss</p>
            <CurrencyDisplay amount={investment.unrealized_gain ?? 0} showSign className="mt-1 text-xl font-bold" />
            <p className={cn(
              "text-sm",
              (investment.absolute_return_pct ?? 0) >= 0 ? "text-green-600" : "text-red-600",
            )}>
              {(investment.absolute_return_pct ?? 0) >= 0 ? "+" : ""}{(investment.absolute_return_pct ?? 0).toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-4 sm:grid-cols-3 text-sm">
            <div><dt className="text-gray-500">Expected CAGR</dt><dd className="font-medium">{investment.expected_cagr}%</dd></div>
            <div><dt className="text-gray-500">Created</dt><dd className="font-medium">{formatDate(investment.created_at)}</dd></div>
            <div><dt className="text-gray-500">Status</dt><dd className="font-medium">{investment.is_active ? "Active" : "Inactive"}</dd></div>
            {investment.notes && (
              <div className="sm:col-span-3"><dt className="text-gray-500">Notes</dt><dd className="font-medium">{investment.notes}</dd></div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Linked goal */}
      {investment.goal_name && (
        <Card>
          <CardHeader><CardTitle>Linked Goal</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
              <Link href={`/goals/${investment.goal_id}`} className="text-indigo-600 hover:underline text-sm font-medium">
                {investment.goal_name}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entry history */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Monthly Entry History</CardTitle>
          <Button size="sm" asChild>
            <Link href={`/investments/${investmentId}/entries/new`}>
              <Plus className="h-4 w-4" /> Add Entry
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {(entriesData?.entries.length ?? 0) === 0 ? (
            <EmptyState title="No entries yet" description="Add your first monthly entry" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {["Month", "Total Invested", "Current Value", "Gain/Loss", "Return %", "MoM Change"].map((h) => (
                      <th key={h} className={cn("px-3 py-2 text-xs font-medium text-gray-500", h === "Month" ? "text-left" : "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entriesData?.entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2 text-gray-900">{formatDate(entry.entry_month)}</td>
                      <td className="px-3 py-2 text-right font-mono">₹{formatINR(entry.total_invested)}</td>
                      <td className="px-3 py-2 text-right font-mono">₹{formatINR(entry.current_value)}</td>
                      <td className="px-3 py-2 text-right">
                        <CurrencyDisplay amount={entry.unrealized_gain} showSign className="text-sm" />
                      </td>
                      <td className={cn("px-3 py-2 text-right text-sm", (entry.absolute_return_pct ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                        {(entry.absolute_return_pct ?? 0) >= 0 ? "+" : ""}{(entry.absolute_return_pct ?? 0).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {entry.month_over_month_value_change !== null
                          ? `${entry.month_over_month_value_change >= 0 ? "+" : ""}₹${formatINR(entry.month_over_month_value_change)}`
                          : "—"}
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
