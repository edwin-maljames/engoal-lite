"use client";
import React from "react";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateInvestment, useUpdateInvestment } from "@/hooks/use-investments";
import { investmentSchema, type InvestmentInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ASSET_CLASS_LABELS, ASSET_CLASSES, ASSET_CLASS_DEFAULT_CAGR, HIGH_CAGR_WARNING_THRESHOLD } from "@/lib/constants";
import type { Investment } from "@/types";

interface InvestmentFormProps {
  investment?: Investment;
  investmentId?: string;
}

export function InvestmentForm({ investment, investmentId }: InvestmentFormProps): React.JSX.Element {
  const router = useRouter();
  const { mutateAsync: createInvestment, isPending: isCreating } = useCreateInvestment();
  const { mutateAsync: updateInvestment, isPending: isUpdating } = useUpdateInvestment(investmentId ?? "");

  const isEditing = !!investmentId;
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvestmentInput>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      name: investment?.name ?? "",
      asset_class: investment?.asset_class ?? "equity_mf",
      expected_cagr: investment?.expected_cagr ?? ASSET_CLASS_DEFAULT_CAGR["equity_mf"],
      start_date: investment?.start_date ?? new Date().toISOString().split("T")[0],
      notes: investment?.notes ?? "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedAssetClass = watch("asset_class");
  const watchedCagr = watch("expected_cagr");
  const showHighCagrWarning = watchedCagr > HIGH_CAGR_WARNING_THRESHOLD;

  // Update default CAGR when asset class changes (only for new investments)
  useEffect(() => {
    if (!isEditing) {
      setValue("expected_cagr", ASSET_CLASS_DEFAULT_CAGR[watchedAssetClass]);
    }
  }, [watchedAssetClass, isEditing, setValue]);

  async function onSubmit(data: InvestmentInput): Promise<void> {
    if (isEditing) {
      await updateInvestment(data);
      router.push(`/investments/${investmentId}`);
    } else {
      const newInv = await createInvestment(data);
      router.push(`/investments/${(newInv as Investment).id}`);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Investment Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Parag Parikh Flexi Cap Fund"
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="asset_class">Asset Class *</Label>
              <Controller
                name="asset_class"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_CLASSES.map((ac) => (
                        <SelectItem key={ac} value={ac}>
                          {ASSET_CLASS_LABELS[ac]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.asset_class && <p className="text-xs text-red-600">{errors.asset_class.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expected_cagr">Expected Annual Return (%) *</Label>
              <Input
                id="expected_cagr"
                type="number"
                min={0}
                max={100}
                step={0.1}
                {...register("expected_cagr", { valueAsNumber: true })}
              />
              {showHighCagrWarning && (
                <p className="text-xs text-amber-600">
                  An expected return of {watchedCagr}% is unusually high. Are you sure?
                </p>
              )}
              {errors.expected_cagr && <p className="text-xs text-red-600">{errors.expected_cagr.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="start_date">Start Date *</Label>
            <Input
              id="start_date"
              type="date"
              max={new Date().toISOString().split("T")[0]}
              {...register("start_date")}
            />
            {errors.start_date && <p className="text-xs text-red-600">{errors.start_date.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="e.g., SIP of ₹10,000/month, Maturity: March 2028"
              rows={3}
              {...register("notes")}
            />
            {errors.notes && <p className="text-xs text-red-600">{errors.notes.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Update Investment" : "Add Investment"}
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
