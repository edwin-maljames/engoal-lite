"use client";
import React from "react";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useInvestments } from "@/hooks/use-investments";
import { useSubmitBulkEntries } from "@/hooks/use-entries";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ASSET_CLASS_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/format-currency";
import { getLast12Months } from "@/lib/utils";

interface EntryRow {
  investment_id: string;
  total_invested: string;
  current_value: string;
}

export default function MonthlyEntryPage(): React.JSX.Element {
  const months = getLast12Months();
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [entryRows, setEntryRows] = useState<Record<string, EntryRow>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ totalValue: number; totalInvested: number } | null>(null);

  const { data: investmentsData, isLoading } = useInvestments({ is_active: true });
  const { mutateAsync: submitBulk, isPending: isSubmitting } = useSubmitBulkEntries();

  const investments = investmentsData?.investments ?? [];

  function updateRow(investmentId: string, field: "total_invested" | "current_value", value: string): void {
    setEntryRows((prev) => ({
      ...prev,
      [investmentId]: {
        investment_id: investmentId,
        total_invested: field === "total_invested" ? value : prev[investmentId]?.total_invested ?? "",
        current_value: field === "current_value" ? value : prev[investmentId]?.current_value ?? "",
      },
    }));
  }

  async function handleSubmit(): Promise<void> {
    const entries = Object.values(entryRows)
      .filter((row) => row.total_invested || row.current_value)
      .map((row) => ({
        investment_id: row.investment_id,
        total_invested: parseFloat(row.total_invested) || 0,
        current_value: parseFloat(row.current_value) || 0,
      }));

    if (entries.length === 0) return;

    await submitBulk({ entry_month: selectedMonth, entries });

    const totalValue = entries.reduce((s, e) => s + e.current_value, 0);
    const totalInvested = entries.reduce((s, e) => s + e.total_invested, 0);
    setSubmitResult({ totalValue, totalInvested });
    setSubmitted(true);
  }

  if (submitted && submitResult) {
    return (
      <div className="space-y-6">
        <PageHeader title="Monthly Entry" />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900">Entry submitted successfully!</h2>
            <div className="grid gap-4 sm:grid-cols-2 text-center">
              <div>
                <p className="text-sm text-gray-500">Total Portfolio Value</p>
                <p className="text-2xl font-bold">₹{formatINR(submitResult.totalValue)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Invested</p>
                <p className="text-2xl font-bold">₹{formatINR(submitResult.totalInvested)}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={() => { setSubmitted(false); setEntryRows({}); }}>
                Enter another month
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Entry"
        description="Enter your portfolio values for the selected month"
      />

      {/* Month selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Select Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-52">
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
          </div>
        </CardContent>
      </Card>

      {/* Entry form */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Values</CardTitle>
          <p className="text-sm text-gray-500">
            Enter the <strong>cumulative total invested</strong> (not monthly increment) and current market value for each investment.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />)}
            </div>
          ) : investments.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No active investments. Add investments first.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Investment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Class</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Prev Value</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Prev Invested</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 min-w-[160px]">Total Invested (₹) *</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 min-w-[160px]">Current Value (₹) *</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => {
                    const row = entryRows[inv.id];
                    return (
                      <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-900">{inv.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">{ASSET_CLASS_LABELS[inv.asset_class]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500 text-xs">
                          {inv.latest_entry_month ? `₹${formatINR(inv.latest_current_value ?? 0)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500 text-xs">
                          {inv.latest_entry_month ? `₹${formatINR(inv.latest_total_invested ?? 0)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            placeholder={(inv.latest_total_invested ?? 0) > 0 ? String(inv.latest_total_invested) : "0"}
                            value={row?.total_invested ?? ""}
                            onChange={(e) => updateRow(inv.id, "total_invested", e.target.value)}
                            className="text-right w-40 ml-auto"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            placeholder={(inv.latest_current_value ?? 0) > 0 ? String(inv.latest_current_value) : "0"}
                            value={row?.current_value ?? ""}
                            onChange={(e) => updateRow(inv.id, "current_value", e.target.value)}
                            className="text-right w-40 ml-auto"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => setEntryRows({})}
          disabled={Object.keys(entryRows).length === 0}
        >
          Clear
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || Object.keys(entryRows).length === 0}
        >
          {isSubmitting ? "Submitting..." : "Submit Monthly Data"}
        </Button>
      </div>
    </div>
  );
}
