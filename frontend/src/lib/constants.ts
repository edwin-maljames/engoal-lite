import type { AssetClass } from "@/types/goal";

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity_mf: "Equity Mutual Fund",
  debt_mf: "Debt Mutual Fund",
  fixed_deposit: "Fixed Deposit",
  gold: "Gold",
  real_estate: "Real Estate",
  smallcase: "Smallcase",
};

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  equity_mf: "#6366f1",   // indigo
  debt_mf: "#22c55e",     // green
  fixed_deposit: "#f59e0b", // amber
  gold: "#eab308",        // yellow
  real_estate: "#8b5cf6", // purple
  smallcase: "#06b6d4",   // cyan
};

export const ASSET_CLASS_DEFAULT_CAGR: Record<AssetClass, number> = {
  equity_mf: 12,
  debt_mf: 7,
  fixed_deposit: 7,
  gold: 9,
  real_estate: 8,
  smallcase: 14,
};

export const ASSET_CLASSES: AssetClass[] = [
  "equity_mf",
  "debt_mf",
  "fixed_deposit",
  "gold",
  "real_estate",
  "smallcase",
];

export const RAG_CONFIG = {
  green: {
    label: "On Track",
    badgeClasses: "bg-green-100 text-green-800 border-green-200",
    dotClass: "bg-green-500",
  },
  amber: {
    label: "Slightly Behind",
    badgeClasses: "bg-amber-100 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  red: {
    label: "Significantly Behind",
    badgeClasses: "bg-red-100 text-red-800 border-red-200",
    dotClass: "bg-red-500",
  },
  not_started: {
    label: "Not Started",
    badgeClasses: "bg-gray-100 text-gray-600 border-gray-200",
    dotClass: "bg-gray-400",
  },
} as const;

export const GOAL_PRIORITY_LABELS = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
} as const;

export const GOAL_STATUS_LABELS = {
  active: "Active",
  achieved: "Achieved",
  abandoned: "Abandoned",
} as const;

export const HIGH_CAGR_WARNING_THRESHOLD = 30;
