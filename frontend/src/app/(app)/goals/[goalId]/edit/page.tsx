"use client";
import React from "react";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useGoal } from "@/hooks/use-goals";
import { GoalForm } from "@/components/forms/goal-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

interface EditGoalPageProps {
  params: Promise<{ goalId: string }>;
}

export default function EditGoalPage({ params }: EditGoalPageProps): React.JSX.Element {
  const { goalId } = use(params);
  const { data: goal, isLoading } = useGoal(goalId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/goals/${goalId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Edit Goal" />
      </div>
      {goal && <GoalForm goal={goal} goalId={goalId} />}
    </div>
  );
}
