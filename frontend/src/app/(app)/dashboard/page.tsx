"use client";
import React from "react";

import Link from "next/link";
import { AlertCircle, TrendingUp, Target, Plus } from "lucide-react";
import { useDashboard } from "@/hooks/use-dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { RAGBadge } from "@/components/shared/rag-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CardSkeleton, GoalCardSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AssetAllocationChart } from "@/components/charts/asset-allocation-chart";
import { formatINR } from "@/lib/format-currency";
import { formatDate, isAfter25th, getCurrentMonthISO } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function DashboardPage(): React.JSX.Element {
  const { data: dashboard, isLoading, error } = useDashboard();

  const currentMonth = getCurrentMonthISO();
  const hasCurrentMonthEntries = (dashboard?.recent_entries ?? []).some(
    (e) => e.entry_month === currentMonth,
  );
  const showEntryBanner = isAfter25th() && !hasCurrentMonthEntries;

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-red-600">Failed to load dashboard. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your portfolio at a glance"
        action={
          <Button asChild>
            <Link href="/monthly-entry">
              <Plus className="h-4 w-4" />
              Monthly Entry
            </Link>
          </Button>
        }
      />

      {/* Monthly entry reminder banner */}
      {showEntryBanner && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">
            You haven&apos;t entered your monthly data for this month.{" "}
            <Link href="/monthly-entry" className="font-semibold underline">
              Enter now
            </Link>
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard
              title="Total Invested"
              value={dashboard?.summary.total_invested ?? 0}
              formatted={dashboard?.summary.total_invested_formatted}
              icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
            />
            <SummaryCard
              title="Current Value"
              value={dashboard?.summary.total_current_value ?? 0}
              formatted={dashboard?.summary.total_current_value_formatted}
              icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            />
            <SummaryCard
              title="Total Gain/Loss"
              value={dashboard?.summary.total_unrealized_gain ?? 0}
              showSign
              icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
              subtitle={`${(dashboard?.summary.overall_return_pct ?? 0).toFixed(2)}% overall return`}
            />
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">Active Goals</span>
                  <Target className="h-5 w-5 text-indigo-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {dashboard?.summary.active_goals ?? 0}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {dashboard?.summary.goals_on_track ?? 0} on track,{" "}
                  {dashboard?.summary.goals_at_risk ?? 0} at risk
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Goals overview */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Goals</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/goals">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <GoalCardSkeleton key={i} />
                ))}
              </div>
            ) : dashboard?.goals.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No goals yet"
                description="Create your first financial goal to start tracking"
                action={
                  <Button asChild size="sm">
                    <Link href="/goals/new">Create goal</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {(dashboard?.goals ?? [])
                  .sort((a, b) => {
                    const order = { red: 0, amber: 1, green: 2, not_started: 3 };
                    return order[a.rag_status] - order[b.rag_status];
                  })
                  .slice(0, 5)
                  .map((goal) => (
                    <Link
                      key={goal.id}
                      href={`/goals/${goal.id}`}
                      className="block rounded-lg border border-gray-100 p-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900">{goal.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Target: ₹{goal.target_amount_formatted} · {formatDate(goal.target_date)}
                          </p>
                        </div>
                        <RAGBadge status={goal.rag_status} size="sm" />
                      </div>
                      <div className="mt-3">
                        <Progress
                          value={Math.min(100, goal.progress_pct)}
                          className="h-1.5"
                          indicatorClassName={cn(
                            goal.rag_status === "green"
                              ? "bg-green-500"
                              : goal.rag_status === "amber"
                                ? "bg-amber-500"
                                : goal.rag_status === "red"
                                  ? "bg-red-500"
                                  : "bg-gray-400",
                          )}
                        />
                        <p className="mt-1 text-right text-xs text-gray-500">
                          {(goal.progress_pct ?? 0).toFixed(1)}%
                        </p>
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asset allocation */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Asset Allocation</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/allocation">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 animate-pulse rounded bg-gray-100" />
            ) : (dashboard?.asset_allocation.length ?? 0) === 0 ? (
              <EmptyState title="No investments yet" description="Add investments to see allocation" />
            ) : (
              <AssetAllocationChart data={dashboard?.asset_allocation ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (dashboard?.recent_entries.length ?? 0) === 0 ? (
            <EmptyState title="No recent activity" description="Monthly entries will appear here" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 text-left font-medium text-gray-500">Investment</th>
                    <th className="pb-2 text-left font-medium text-gray-500">Month</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Value</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Invested</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.recent_entries ?? []).slice(0, 10).map((entry, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-900">{entry.investment_name}</td>
                      <td className="py-2 text-gray-500">{formatDate(entry.entry_month)}</td>
                      <td className="py-2 text-right font-mono">
                        ₹{formatINR(entry.current_value)}
                      </td>
                      <td className="py-2 text-right font-mono text-gray-500">
                        ₹{formatINR(entry.total_invested)}
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

function SummaryCard({
  title,
  value,
  formatted,
  showSign = false,
  icon,
  subtitle,
}: {
  title: string;
  value: number;
  formatted?: string;
  showSign?: boolean;
  icon: React.ReactNode;
  subtitle?: string;
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">{title}</span>
          {icon}
        </div>
        <div className="mt-2">
          <CurrencyDisplay
            amount={value}
            formatted={formatted ? `₹${formatted}` : undefined}
            showSign={showSign}
            className="text-2xl font-bold"
          />
        </div>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
