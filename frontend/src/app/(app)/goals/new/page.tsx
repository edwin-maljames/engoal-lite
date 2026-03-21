import React from "react";
import { GoalForm } from "@/components/forms/goal-form";
import { PageHeader } from "@/components/shared/page-header";

export default function NewGoalPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Create Goal" description="Set a new financial target" />
      <GoalForm />
    </div>
  );
}
