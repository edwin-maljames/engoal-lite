import { describe, expect, it } from "vitest";
import { loginSchema, goalSchema, investmentSchema, entrySchema } from "@/lib/validators";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "Password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-email", password: "Password123" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "123" });
    expect(result.success).toBe(false);
  });
});

describe("goalSchema", () => {
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  const futureDateStr = futureDate.toISOString().split("T")[0];

  it("accepts valid goal", () => {
    const result = goalSchema.safeParse({
      name: "Retirement",
      target_amount: 5000000,
      target_date: futureDateStr,
      priority: "HIGH",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = goalSchema.safeParse({
      name: "",
      target_amount: 5000000,
      target_date: futureDateStr,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative target amount", () => {
    const result = goalSchema.safeParse({
      name: "Goal",
      target_amount: -1000,
      target_date: futureDateStr,
    });
    expect(result.success).toBe(false);
  });

  it("rejects past target date", () => {
    const result = goalSchema.safeParse({
      name: "Goal",
      target_amount: 1000000,
      target_date: "2020-01-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("investmentSchema", () => {
  const validGoalId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  it("accepts valid investment with equity_mf", () => {
    const result = investmentSchema.safeParse({
      goal_id: validGoalId,
      name: "Nifty 50 Index Fund",
      asset_class: "equity_mf",
      expected_cagr: 12,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid investment with smallcase", () => {
    const result = investmentSchema.safeParse({
      goal_id: validGoalId,
      name: "Windmill Capital Smallcase",
      asset_class: "smallcase",
      expected_cagr: 16,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all supported asset classes", () => {
    const assetClasses = ["equity_mf", "debt_mf", "fixed_deposit", "gold", "real_estate", "smallcase"];
    for (const ac of assetClasses) {
      const result = investmentSchema.safeParse({
        goal_id: validGoalId,
        name: "Test",
        asset_class: ac,
        expected_cagr: 10,
      });
      expect(result.success, `Should accept ${ac}`).toBe(true);
    }
  });

  it("rejects negative CAGR", () => {
    const result = investmentSchema.safeParse({
      goal_id: validGoalId,
      name: "Fund",
      asset_class: "equity_mf",
      expected_cagr: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects CAGR above 100", () => {
    const result = investmentSchema.safeParse({
      goal_id: validGoalId,
      name: "Fund",
      asset_class: "equity_mf",
      expected_cagr: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing goal_id", () => {
    const result = investmentSchema.safeParse({
      name: "Fund",
      asset_class: "equity_mf",
      expected_cagr: 12,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid goal_id", () => {
    const result = investmentSchema.safeParse({
      goal_id: "not-a-uuid",
      name: "Fund",
      asset_class: "equity_mf",
      expected_cagr: 12,
    });
    expect(result.success).toBe(false);
  });
});

describe("entrySchema", () => {
  it("accepts valid entry", () => {
    const result = entrySchema.safeParse({
      entry_month: "2026-02-01",
      total_invested: 550000,
      current_value: 680000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero current value (full loss scenario)", () => {
    const result = entrySchema.safeParse({
      entry_month: "2026-02-01",
      total_invested: 100000,
      current_value: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative total invested", () => {
    const result = entrySchema.safeParse({
      entry_month: "2026-02-01",
      total_invested: -1000,
      current_value: 100000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative current value", () => {
    const result = entrySchema.safeParse({
      entry_month: "2026-02-01",
      total_invested: 100000,
      current_value: -500,
    });
    expect(result.success).toBe(false);
  });
});
