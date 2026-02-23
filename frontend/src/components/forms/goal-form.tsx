"use client";
import React from "react";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateGoal, useUpdateGoal } from "@/hooks/use-goals";
import { goalSchema, type GoalInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { GOAL_PRIORITY_LABELS } from "@/lib/constants";
import type { Goal } from "@/types";

interface GoalFormProps {
  goal?: Goal;
  goalId?: string;
}

export function GoalForm({ goal, goalId }: GoalFormProps): React.JSX.Element {
  const router = useRouter();
  const { mutateAsync: createGoal, isPending: isCreating } = useCreateGoal();
  const { mutateAsync: updateGoal, isPending: isUpdating } = useUpdateGoal(goalId ?? "");

  const isEditing = !!goalId;
  const isPending = isCreating || isUpdating;

  const defaultTargetDate = goal?.target_date
    ? goal.target_date.slice(0, 7) // YYYY-MM for input[type=month]
    : "";

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<GoalInput>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: goal?.name ?? "",
      description: goal?.description ?? "",
      target_amount: goal?.target_amount,
      target_date: defaultTargetDate,
      priority: goal?.priority ?? "MEDIUM",
    },
  });

  async function onSubmit(data: GoalInput): Promise<void> {
    // Convert YYYY-MM to YYYY-MM-01
    const targetDate = data.target_date.length === 7
      ? `${data.target_date}-01`
      : data.target_date;

    if (isEditing) {
      await updateGoal({ ...data, target_date: targetDate });
      router.push(`/goals/${goalId}`);
    } else {
      const newGoal = await createGoal({ ...data, target_date: targetDate });
      router.push(`/goals/${(newGoal as Goal).id}`);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Goal Name *</Label>
            <Input id="name" placeholder="e.g., Retirement Corpus" {...register("name")} />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional notes about this goal"
              rows={3}
              {...register("description")}
            />
            {errors.description && <p className="text-xs text-red-600">{errors.description.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="target_amount">Target Amount (₹) *</Label>
              <Input
                id="target_amount"
                type="number"
                min={1}
                step={1000}
                placeholder="e.g., 5000000"
                {...register("target_amount", { valueAsNumber: true })}
              />
              {errors.target_amount && <p className="text-xs text-red-600">{errors.target_amount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target_date">Target Date *</Label>
              <Input
                id="target_date"
                type="month"
                {...register("target_date")}
              />
              {errors.target_date && <p className="text-xs text-red-600">{errors.target_date.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority</Label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(GOAL_PRIORITY_LABELS) as [string, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Update Goal" : "Create Goal"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
