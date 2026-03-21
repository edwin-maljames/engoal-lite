"use client";
import React from "react";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Edit, Trash2, Link2, TrendingUp, AlertTriangle } from "lucide-react";
import { useGoal, useGoalProjection, useDeleteGoal, useUpdateGoal } from "@/hooks/use-goals";
import { RAGBadge } from "@/components/shared/rag-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalProjectionChart } from "@/components/charts/goal-projection-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ASSET_CLASS_LABELS, GOAL_PRIORITY_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/format-currency";
import { formatDate } from "@/lib/utils";
import { formatTimeRemaining } from "@/lib/rag-utils";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface GoalDetailPageProps {
  params: Promise<{ goalId: string }>;
}

export default function GoalDetailPage({ params }: GoalDetailPageProps): React.JSX.Element {
  const { goalId } = use(params);
  const router = useRouter();
  const { data: goal, isLoading } = useGoal(goalId);
  const { data: projection } = useGoalProjection(goalId);
  const { mutateAsync: deleteGoal, isPending: isDeleting } = useDeleteGoal();
  const { mutateAsync: updateGoal } = useUpdateGoal(goalId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!goal) {
    return (
      <EmptyState
        title="Goal not found"
        description="This goal may have been deleted"
        action={<Button asChild><Link href="/goals">Back to goals</Link></Button>}
      />
    );
  }

  const isPastDue = new Date(goal.target_date) < new Date();
  const isAchieved = goal.total_current_value >= goal.target_amount;

  async function handleDelete(): Promise<void> {
    await deleteGoal(goalId);
    router.push("/goals");
  }

  async function handleMarkAchieved(): Promise<void> {
    await updateGoal({ status: "achieved" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/goals">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title={goal.name}
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/goals/${goalId}/edit`}>
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                    Abandon
                  </Button>
                }
                title="Abandon this goal?"
                description={`Are you sure you want to abandon "${goal.name}"? This will unlink all investments from this goal.`}
                confirmLabel="Yes, abandon goal"
                onConfirm={handleDelete}
                isLoading={isDeleting}
              />
            </div>
          }
        />
      </div>

      {/* Goal header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              {goal.description && (
                <p className="text-sm text-gray-600">{goal.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <RAGBadge status={goal.rag_status} size="lg" progressPct={goal.progress_pct} />
                <Badge variant="outline">{GOAL_PRIORITY_LABELS[goal.priority]} Priority</Badge>
                {isPastDue && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Past Due
                  </Badge>
                )}
                {isAchieved && goal.status !== "achieved" && (
                  <Button size="sm" variant="secondary" onClick={handleMarkAchieved}>
                    Mark as Achieved
                  </Button>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900">
                ₹{goal.target_amount_formatted}
              </p>
              <p className="text-sm text-gray-500">
                Target by {formatDate(goal.target_date)}
              </p>
              <p className="text-xs text-gray-400">{formatTimeRemaining(goal.target_date)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Progress</span>
              <span className="font-medium">{goal.progress_pct.toFixed(1)}%</span>
            </div>
            <Progress
              value={Math.min(100, goal.progress_pct)}
              className="h-3"
              indicatorClassName={cn(
                goal.rag_status === "green" ? "bg-green-500" :
                goal.rag_status === "amber" ? "bg-amber-500" :
                goal.rag_status === "red" ? "bg-red-500" : "bg-gray-400",
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Progress summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total Invested</p>
            <CurrencyDisplay amount={goal.total_invested} className="mt-1 text-xl font-bold" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Current Value</p>
            <CurrencyDisplay amount={goal.total_current_value} className="mt-1 text-xl font-bold" />
            <CurrencyDisplay
              amount={goal.total_current_value - goal.total_invested}
              showSign
              className="text-sm"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Projected Value</p>
            <CurrencyDisplay amount={goal.total_projected_value} className="mt-1 text-xl font-bold" />
            {projection?.recommended_monthly_sip && (
              <p className="mt-1 text-xs text-amber-700">
                Start ₹{formatINR(projection.recommended_monthly_sip)}/mo SIP to close gap
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projection chart */}
      {projection && projection.investments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projected Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <GoalProjectionChart projection={projection} />
          </CardContent>
        </Card>
      )}

      {/* Linked investments */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Linked Investments</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/investments/new">
              <Link2 className="h-4 w-4" />
              Link Investment
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {(projection?.investments.length ?? 0) === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No investments linked"
              description="Link investments to start tracking progress toward this goal"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 text-left font-medium text-gray-500">Investment</th>
                    <th className="pb-2 text-left font-medium text-gray-500">Asset Class</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Alloc %</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Allocated Value</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Projected</th>
                    <th className="pb-2 text-right font-medium text-gray-500">CAGR</th>
                  </tr>
                </thead>
                <tbody>
                  {projection?.investments.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2">
                        <Link
                          href={`/investments/${inv.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {inv.name}
                        </Link>
                      </td>
                      <td className="py-2 text-gray-500">
                        {ASSET_CLASS_LABELS[inv.asset_class]}
                      </td>
                      <td className="py-2 text-right">{inv.allocation_pct}%</td>
                      <td className="py-2 text-right font-mono">
                        ₹{formatINR(inv.latest_value)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        ₹{formatINR(inv.projected_value)}
                      </td>
                      <td className="py-2 text-right text-gray-500">{inv.expected_cagr}%</td>
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
