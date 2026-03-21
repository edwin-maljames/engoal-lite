"use client";
import React from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatINR } from "@/lib/format-currency";
import { projectFutureValue } from "@/lib/rag-utils";
import type { GoalProjection } from "@/types";

interface GoalProjectionChartProps {
  projection: GoalProjection;
}

function generateProjectionData(projection: GoalProjection): Array<{
  month: string;
  projected: number;
  target: number;
}> {
  const today = new Date();
  const targetDate = new Date(projection.target_date);
  const totalMonths = Math.max(
    1,
    (targetDate.getFullYear() - today.getFullYear()) * 12 +
      (targetDate.getMonth() - today.getMonth()),
  );

  const step = Math.max(1, Math.floor(totalMonths / 24));
  const data: Array<{ month: string; projected: number; target: number }> = [];

  for (let m = 0; m <= totalMonths; m += step) {
    const date = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const yearsElapsed = m / 12;
    const projectedValue = projection.investments.reduce((sum, inv) => {
      return sum + projectFutureValue(inv.latest_value, inv.expected_cagr, yearsElapsed);
    }, 0);

    data.push({
      month: date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      projected: Math.round(projectedValue),
      target: projection.target_amount,
    });
  }

  return data;
}

export function GoalProjectionChart({ projection }: GoalProjectionChartProps): React.JSX.Element {
  const data = generateProjectionData(projection);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11 }}
          interval={Math.floor(data.length / 6)}
        />
        <YAxis
          tickFormatter={(v: number) => `₹${formatINR(v)}`}
          tick={{ fontSize: 11 }}
          width={80}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `₹${formatINR(value)}`,
            name === "projected" ? "Projected Value" : "Target",
          ]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="projected"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          name="Projected Value"
        />
        <ReferenceLine
          y={projection.target_amount}
          stroke="#ef4444"
          strokeDasharray="4 4"
          strokeWidth={2}
          label={{
            value: `Target: ₹${formatINR(projection.target_amount)}`,
            fill: "#ef4444",
            fontSize: 11,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
