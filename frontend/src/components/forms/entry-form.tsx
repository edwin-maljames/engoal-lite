"use client";
import React from "react";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateEntry } from "@/hooks/use-entries";
import { entrySchema, type EntryInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { getLast12Months } from "@/lib/utils";
import { formatINR } from "@/lib/format-currency";
import type { Investment } from "@/types";

interface EntryFormProps {
  investmentId: string;
  investment?: Investment;
}

export function EntryForm({ investmentId, investment }: EntryFormProps): React.JSX.Element {
  const router = useRouter();
  const months = getLast12Months();
  const { mutateAsync: createEntry, isPending } = useCreateEntry(investmentId);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EntryInput>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      entry_month: months[0].value,
      total_invested: undefined,
      current_value: undefined,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedMonth = watch("entry_month");

  async function onSubmit(data: EntryInput): Promise<void> {
    await createEntry(data);
    router.push(`/investments/${investmentId}`);
  }

  return (
    <Card className="max-w-lg">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Entry Month</Label>
            <Select
              value={watchedMonth}
              onValueChange={(v) => setValue("entry_month", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {investment && (
            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600 space-y-1">
              <p><strong>Previous Value:</strong> {investment.latest_current_value > 0 ? `₹${formatINR(investment.latest_current_value)}` : "—"}</p>
              <p><strong>Previous Invested:</strong> {investment.latest_total_invested > 0 ? `₹${formatINR(investment.latest_total_invested)}` : "—"}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="total_invested">Total Invested to Date (₹) *</Label>
            <Input
              id="total_invested"
              type="number"
              min={0}
              step="any"
              placeholder="Cumulative total invested in this investment"
              {...register("total_invested", { valueAsNumber: true })}
            />
            <p className="text-xs text-gray-500">
              Enter the running total across all time, not the amount added this month.
            </p>
            {errors.total_invested && <p className="text-xs text-red-600">{errors.total_invested.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current_value">Current Market Value (₹) *</Label>
            <Input
              id="current_value"
              type="number"
              min={0}
              step="any"
              placeholder="Current market value of this investment"
              {...register("current_value", { valueAsNumber: true })}
            />
            {errors.current_value && <p className="text-xs text-red-600">{errors.current_value.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Entry"}
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
