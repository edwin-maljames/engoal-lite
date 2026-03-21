"use client";
import React from "react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/format-currency";
import type { AssetClass } from "@/types";

interface HistoryDataPoint {
  month: string;
  [key: string]: string | number;
}

interface AllocationHistoryChartProps {
  data: HistoryDataPoint[];
  assetClasses: AssetClass[];
}

export function AllocationHistoryChart({
  data,
  assetClasses,
}: AllocationHistoryChartProps): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis
          tickFormatter={(v: number) => `₹${formatINR(v)}`}
          tick={{ fontSize: 11 }}
          width={80}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `₹${formatINR(value)}`,
            ASSET_CLASS_LABELS[name as AssetClass] || name,
          ]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
        />
        <Legend
          formatter={(value) => ASSET_CLASS_LABELS[value as AssetClass] || value}
        />
        {assetClasses.map((ac) => (
          <Bar
            key={ac}
            dataKey={ac}
            stackId="a"
            fill={ASSET_CLASS_COLORS[ac]}
            name={ac}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
