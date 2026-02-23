import type { RAGStatus } from "@/types/goal";

/**
 * Calculate RAG status from progress percentage.
 * progress_pct >= 100 → GREEN
 * progress_pct >= 85  → AMBER
 * progress_pct < 85   → RED
 */
export function calculateRAGFromProgress(progressPct: number): RAGStatus {
  if (progressPct >= 100) return "green";
  if (progressPct >= 85) return "amber";
  return "red";
}

/**
 * Project future value: FV = CV * (1 + r)^t
 */
export function projectFutureValue(
  currentValue: number,
  cagrPct: number,
  yearsRemaining: number,
): number {
  if (yearsRemaining <= 0 || currentValue <= 0) return currentValue;
  const rate = cagrPct / 100;
  return currentValue * Math.pow(1 + rate, yearsRemaining);
}

/**
 * Calculate years remaining from today to target date.
 */
export function yearsUntil(targetDate: string): number {
  const target = new Date(targetDate);
  const today = new Date();
  const diffMs = target.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(0, diffDays / 365.25);
}

/**
 * Calculate monthly SIP needed to close a shortfall.
 * Uses PMT formula: SIP = gap * r / ((1+r)^n - 1)
 */
export function calculateRequiredSIP(
  shortfall: number,
  weightedCagrPct: number,
  yearsRemaining: number,
): number | null {
  if (shortfall <= 0 || yearsRemaining <= 0) return null;
  const monthlyRate = Math.pow(1 + weightedCagrPct / 100, 1 / 12) - 1;
  const monthsRemaining = Math.round(yearsRemaining * 12);
  if (monthlyRate <= 0 || monthsRemaining <= 0) return null;
  return (
    (shortfall * monthlyRate) /
    (Math.pow(1 + monthlyRate, monthsRemaining) - 1)
  );
}

/**
 * Format time remaining as "X years, Y months".
 */
export function formatTimeRemaining(targetDate: string): string {
  const target = new Date(targetDate);
  const today = new Date();

  if (target <= today) return "Past due";

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Less than 28 days is considered "< 1 month" regardless of calendar month boundary
  if (diffDays < 28) return "< 1 month";

  let years = target.getFullYear() - today.getFullYear();
  let months = target.getMonth() - today.getMonth();

  if (months < 0) {
    years--;
    months += 12;
  }
  // Adjust if day-of-month hasn't been reached yet
  if (target.getDate() < today.getDate()) {
    months--;
    if (months < 0) {
      years--;
      months += 12;
    }
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  if (parts.length === 0) return "< 1 month";
  return parts.join(", ");
}
