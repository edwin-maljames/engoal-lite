import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const goalSchema = z.object({
  name: z
    .string()
    .min(1, "Goal name is required")
    .max(200, "Goal name must be under 200 characters"),
  description: z.string().max(1000, "Description must be under 1000 characters").optional(),
  target_amount: z
    .number({ invalid_type_error: "Target amount must be a number" })
    .positive("Target amount must be greater than 0")
    .max(99_99_99_99_999, "Target amount exceeds maximum (999 crores)"),
  target_date: z
    .string()
    .min(1, "Target date is required")
    .refine((d) => {
      const date = new Date(d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date > today;
    }, "Target date must be in the future"),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
});

export const investmentSchema = z.object({
  name: z
    .string()
    .min(1, "Investment name is required")
    .max(200, "Investment name must be under 200 characters"),
  asset_class: z.enum([
    "equity_mf",
    "debt_mf",
    "fixed_deposit",
    "gold",
    "real_estate",
    "smallcase",
  ]),
  expected_cagr: z
    .number({ invalid_type_error: "Expected return must be a number" })
    .min(0, "Expected return cannot be negative")
    .max(100, "Expected return cannot exceed 100%"),
  start_date: z
    .string()
    .min(1, "Start date is required")
    .refine((d) => {
      const date = new Date(d);
      const today = new Date();
      return date <= today;
    }, "Start date cannot be in the future"),
  notes: z.string().max(1000, "Notes must be under 1000 characters").optional(),
});

export const entrySchema = z.object({
  entry_month: z.string().min(1, "Entry month is required"),
  total_invested: z
    .number({ invalid_type_error: "Total invested must be a number" })
    .min(0, "Total invested cannot be negative"),
  current_value: z
    .number({ invalid_type_error: "Current value must be a number" })
    .min(0, "Current value cannot be negative"),
});

export const linkInvestmentSchema = z.object({
  investment_id: z.string().uuid("Please select an investment"),
  allocation_pct: z
    .number({ invalid_type_error: "Allocation must be a number" })
    .min(0.01, "Allocation must be greater than 0")
    .max(100, "Allocation cannot exceed 100%"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type InvestmentInput = z.infer<typeof investmentSchema>;
export type EntryInput = z.infer<typeof entrySchema>;
export type LinkInvestmentInput = z.infer<typeof linkInvestmentSchema>;
