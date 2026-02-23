/**
 * Format a number as INR using Indian numbering system (Lakhs/Crores).
 *
 * Examples:
 *   45000       → "45,000"
 *   150000      → "1.50 L"
 *   2500000     → "25.00 L"
 *   50000000    → "5.00 Cr"
 *   -250000     → "-2.50 L"
 */
export function formatINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    // 1 Crore = 10,000,000
    return `${sign}${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    // 1 Lakh = 100,000
    return `${sign}${(abs / 1_00_000).toFixed(2)} L`;
  }
  if (abs === 0) return "0";
  return `${sign}${abs.toLocaleString("en-IN")}`;
}

/**
 * Format with full Indian number system commas (for tables/detail views).
 * e.g. 1500000 → "₹15,00,000"
 */
export function formatINRFull(amount: number): string {
  if (amount === 0) return "₹0";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  const str = Math.round(abs).toString();
  if (str.length <= 3) return `${sign}₹${str}`;

  const lastThree = str.slice(-3);
  const remaining = str.slice(0, -3);
  const groups: string[] = [];
  for (let i = remaining.length; i > 0; i -= 2) {
    groups.unshift(remaining.slice(Math.max(0, i - 2), i));
  }
  return `${sign}₹${groups.join(",")},${lastThree}`;
}

/**
 * Format with ₹ prefix using compact notation.
 */
export function formatINRCompact(amount: number): string {
  return `₹${formatINR(amount)}`;
}

/**
 * Parse INR formatted string back to number.
 */
export function parseINR(formatted: string): number {
  const cleaned = formatted.replace(/[₹,\s]/g, "").replace(/L$/, "").replace(/Cr$/, "");
  return parseFloat(cleaned) || 0;
}
