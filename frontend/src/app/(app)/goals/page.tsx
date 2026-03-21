"use client";
import React from "react";

import Link from "next/link";
import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { useGoals } from "@/hooks/use-goals";
import { PageHeader } from "@/components/shared/page-header";
import { RAGBadge } from "@/components/shared/rag-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalCardSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GOAL_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { formatTimeRemaining } from "@/lib/rag-utils";
import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/types";

export default function GoalsPage(): React.JSX.Element {
  const [statusFilter, setStatusFilter] = useState<GoalStatus | undefined>("active");
  const { data, isLoading } = useGoals(statusFilter);

  const goals = (data?.goals ?? []).sort((a, b) => {
    const order = { red: 0, amber: 1, green: 2, not_started: 3 };
    const ragDiff = order[a.rag_status] - order[b.rag_status];
    if (ragDiff !== 0) return ragDiff;
    return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description="Track your financial goals"
        action={
          <Button asChild>
            <Link href="/goals/new">
              <Plus className="h-4 w-4" />
              New Goal
            </Link>
          </Button>
        }
      />

      <Tabs value={statusFilter ?? "all"} onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v as GoalStatus)}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="achieved">Achieved</TabsTrigger>
          <TabsTrigger value="abandoned">Abandoned</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <GoalCardSkeleton key={i} />)}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals found"
          description="Create your first financial goal to start tracking progress"
          action={
            <Button asChild>
              <Link href="/goals/new">Create your first goal</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Link key={goal.id} href={`/goals/${goal.id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-gray-900">{goal.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {GOAL_STATUS_LABELS[goal.status]}
                      </p>
                    </div>
                    <RAGBadge status={goal.rag_status} size="sm" />
                  </div>

                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Current</span>
                      <CurrencyDisplay
                        amount={goal.total_current_value}
                        className="text-gray-900 font-medium"
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Target</span>
                      <CurrencyDisplay
                        amount={goal.target_amount}
                        formatted={`₹${goal.target_amount_formatted}`}
                        className="text-gray-900 font-medium"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
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
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-gray-500">
                    <span>{formatDate(goal.target_date)}</span>
                    <span>{formatTimeRemaining(goal.target_date)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
