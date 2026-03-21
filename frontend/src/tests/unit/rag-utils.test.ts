import { describe, expect, it } from "vitest";
import { calculateRAGFromProgress, projectFutureValue, calculateRequiredSIP, formatTimeRemaining } from "@/lib/rag-utils";

describe("calculateRAGFromProgress", () => {
  it("returns green when progress >= 100", () => {
    expect(calculateRAGFromProgress(100)).toBe("green");
    expect(calculateRAGFromProgress(104.6)).toBe("green");
    expect(calculateRAGFromProgress(150)).toBe("green");
  });

  it("returns amber when 85 <= progress < 100", () => {
    expect(calculateRAGFromProgress(85)).toBe("amber");
    expect(calculateRAGFromProgress(91.3)).toBe("amber");
    expect(calculateRAGFromProgress(99.99)).toBe("amber");
  });

  it("returns red when progress < 85", () => {
    expect(calculateRAGFromProgress(84.99)).toBe("red");
    expect(calculateRAGFromProgress(50)).toBe("red");
    expect(calculateRAGFromProgress(0)).toBe("red");
  });
});

describe("projectFutureValue", () => {
  it("returns current value when years is 0", () => {
    expect(projectFutureValue(100000, 12, 0)).toBe(100000);
  });

  it("returns current value when current value is 0", () => {
    expect(projectFutureValue(0, 12, 10)).toBe(0);
  });

  it("calculates 12% CAGR for 1 year correctly", () => {
    const fv = projectFutureValue(100000, 12, 1);
    expect(fv).toBeCloseTo(112000, -2);
  });

  it("calculates compound growth correctly", () => {
    // 100,000 at 12% for 10 years ≈ 310,585
    const fv = projectFutureValue(100000, 12, 10);
    expect(fv).toBeGreaterThan(300000);
    expect(fv).toBeLessThan(320000);
  });

  it("handles 0% CAGR", () => {
    const fv = projectFutureValue(100000, 0, 10);
    expect(fv).toBe(100000);
  });

  it("handles Smallcase high CAGR", () => {
    // 14% CAGR for 5 years on 1,00,000
    const fv = projectFutureValue(100000, 14, 5);
    expect(fv).toBeGreaterThan(190000);
    expect(fv).toBeLessThan(200000);
  });
});

describe("formatTimeRemaining", () => {
  it("returns past due for dates in the past", () => {
    expect(formatTimeRemaining("2020-01-01")).toBe("Past due");
  });

  it("returns years and months for future dates", () => {
    const result = formatTimeRemaining("2030-01-01");
    expect(result).toMatch(/year/);
  });

  it("returns less than 1 month for near future", () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const result = formatTimeRemaining(nextWeek.toISOString().split("T")[0]);
    expect(result).toBe("< 1 month");
  });
});

describe("calculateRequiredSIP", () => {
  it("returns null when shortfall is 0", () => {
    expect(calculateRequiredSIP(0, 12, 10)).toBeNull();
  });

  it("returns null when years remaining is 0", () => {
    expect(calculateRequiredSIP(100000, 12, 0)).toBeNull();
  });

  it("returns a positive number for valid inputs", () => {
    const sip = calculateRequiredSIP(1000000, 12, 5);
    expect(sip).toBeGreaterThan(0);
  });
});
