"use client";
import React from "react";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/format-currency";
import type { AssetAllocationItem } from "@/types";

interface AssetAllocationChartProps {
  data: AssetAllocationItem[];
}

export function AssetAllocationChart({ data }: AssetAllocationChartProps): React.JSX.Element {
  const chartData = data.map((item) => ({
    name: ASSET_CLASS_LABELS[item.asset_class],
    value: item.current_value,
    pct: item.allocation_pct,
    color: ASSET_CLASS_COLORS[item.asset_class],
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`₹${formatINR(value)}`, "Value"]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
        />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-gray-600">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
