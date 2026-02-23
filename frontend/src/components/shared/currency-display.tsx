"use client";
import React from "react";

import { formatINR } from "@/lib/format-currency";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  formatted?: string;
  className?: string;
  showSign?: boolean;
  compact?: boolean;
}

export function CurrencyDisplay({
  amount,
  formatted,
  className,
  showSign = false,
  compact = false,
}: CurrencyDisplayProps): React.JSX.Element {
  const display = formatted || (compact ? `₹${formatINR(amount)}` : `₹${formatINR(amount)}`);
  const isNegative = amount < 0;
  const isPositive = amount > 0;

  const colorClass = isNegative
    ? "text-red-600"
    : isPositive && showSign
      ? "text-green-600"
      : "";

  const prefix = showSign && isPositive ? "+" : "";

  return (
    <span className={cn("font-mono tabular-nums", colorClass, className)}>
      {prefix}
      {display}
    </span>
  );
}
