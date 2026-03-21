import React from "react";
import { cn } from "@/lib/utils";
import { RAG_CONFIG } from "@/lib/constants";
import type { RAGStatus } from "@/types";

interface RAGBadgeProps {
  status: RAGStatus;
  progressPct?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function RAGBadge({
  status,
  progressPct,
  size = "md",
  className,
}: RAGBadgeProps): React.JSX.Element {
  const config = RAG_CONFIG[status];
  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-xs"
      : size === "lg"
        ? "px-4 py-1.5 text-base font-semibold"
        : "px-3 py-1 text-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.badgeClasses,
        sizeClass,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
      {config.label}
      {progressPct !== undefined && (
        <span className="font-mono">({progressPct.toFixed(1)}%)</span>
      )}
    </span>
  );
}
