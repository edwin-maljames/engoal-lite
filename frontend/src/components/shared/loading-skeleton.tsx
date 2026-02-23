import React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <div className={cn("animate-pulse rounded bg-gray-200", className)} />
  );
}

export function CardSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }): React.JSX.Element {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function GoalCardSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-28" />
      <Skeleton className="mt-4 h-2 w-full rounded-full" />
      <div className="mt-3 flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export { Skeleton };
