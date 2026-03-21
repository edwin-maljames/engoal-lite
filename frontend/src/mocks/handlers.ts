import { http, HttpResponse } from "msw";
import {
  MOCK_USER,
  MOCK_GOALS,
  MOCK_INVESTMENTS,
  MOCK_ENTRIES,
  MOCK_DASHBOARD,
  MOCK_GOAL_PROJECTION,
} from "./data";
import type { Goal, Investment, MonthlyEntry } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Mutable store for tests
let goals = [...MOCK_GOALS];
let investments = [...MOCK_INVESTMENTS];
let entries = { ...MOCK_ENTRIES };

export const handlers = [
  // ─── Auth ───────────────────────────────────────────────────────────────────
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    if (body.email === "rahul@example.com" && body.password === "Password123!") {
      return HttpResponse.json({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        token_type: "bearer",
        expires_in: 900,
      });
    }
    return HttpResponse.json(
      { data: null, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } },
      { status: 401 },
    );
  }),

  http.post(`${API_BASE}/auth/refresh`, () => {
    return HttpResponse.json({
      access_token: "mock-access-token-refreshed",
      refresh_token: "mock-refresh-token-new",
      token_type: "bearer",
      expires_in: 900,
    });
  }),

  http.post(`${API_BASE}/auth/logout`, () => {
    return HttpResponse.json({ message: "Successfully logged out." });
  }),

  http.get(`${API_BASE}/auth/me`, () => {
    return HttpResponse.json(MOCK_USER);
  }),

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  http.get(`${API_BASE}/dashboard`, () => {
    return HttpResponse.json(MOCK_DASHBOARD);
  }),

  // ─── Goals ──────────────────────────────────────────────────────────────────
  http.get(`${API_BASE}/goals`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const filtered = status ? goals.filter((g) => g.status === status) : goals;
    return HttpResponse.json({ goals: filtered, count: filtered.length });
  }),

  http.post(`${API_BASE}/goals`, async ({ request }) => {
    const body = await request.json() as Partial<Goal>;
    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      name: body.name || "New Goal",
      description: body.description ?? null,
      target_amount: body.target_amount || 0,
      target_amount_formatted: "0",
      target_date: body.target_date || "",
      status: "active",
      priority: body.priority || "MEDIUM",
      rag_status: "not_started",
      total_invested: 0,
      total_current_value: 0,
      total_projected_value: 0,
      progress_pct: 0,
      investment_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    goals.push(newGoal);
    return HttpResponse.json(newGoal, { status: 201 });
  }),

  http.get(`${API_BASE}/goals/:goalId`, ({ params }) => {
    const goal = goals.find((g) => g.id === params.goalId);
    if (!goal) {
      return HttpResponse.json(
        { data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Goal not found." } },
        { status: 404 },
      );
    }
    return HttpResponse.json(goal);
  }),

  http.put(`${API_BASE}/goals/:goalId`, async ({ params, request }) => {
    const body = await request.json() as Partial<Goal>;
    const idx = goals.findIndex((g) => g.id === params.goalId);
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Goal not found." } },
        { status: 404 },
      );
    }
    goals[idx] = { ...goals[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(goals[idx]);
  }),

  http.delete(`${API_BASE}/goals/:goalId`, ({ params }) => {
    goals = goals.filter((g) => g.id !== params.goalId);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE}/goals/:goalId/projection`, ({ params }) => {
    if (params.goalId === "goal-001") {
      return HttpResponse.json(MOCK_GOAL_PROJECTION);
    }
    const goal = goals.find((g) => g.id === params.goalId);
    if (!goal) {
      return HttpResponse.json(
        { data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Goal not found." } },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      goal_id: goal.id,
      goal_name: goal.name,
      target_amount: goal.target_amount,
      target_date: goal.target_date,
      years_remaining: 10,
      investments: [],
      total_current_value: goal.total_current_value,
      total_projected_value: goal.total_projected_value,
      progress_pct: goal.progress_pct,
      rag_status: goal.rag_status,
      shortfall: Math.max(0, goal.target_amount - goal.total_projected_value),
      shortfall_formatted: "0",
      recommended_monthly_sip: null,
    });
  }),

  // Goal investments (link/unlink)
  http.post(`${API_BASE}/goals/:goalId/investments`, async ({ params, request }) => {
    const body = await request.json() as { investment_id: string; allocation_pct: number };
    return HttpResponse.json({
      id: `link-${Date.now()}`,
      goal_id: params.goalId,
      investment_id: body.investment_id,
      allocation_pct: body.allocation_pct,
      created_at: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.delete(`${API_BASE}/goals/:goalId/investments/:investmentId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // ─── Investments ────────────────────────────────────────────────────────────
  http.get(`${API_BASE}/investments`, ({ request }) => {
    const url = new URL(request.url);
    const isActive = url.searchParams.get("is_active");
    const assetClass = url.searchParams.get("asset_class");
    let filtered = investments;
    if (isActive !== null) {
      filtered = filtered.filter((i) => String(i.is_active) === isActive);
    }
    if (assetClass) {
      filtered = filtered.filter((i) => i.asset_class === assetClass);
    }
    return HttpResponse.json({ investments: filtered, count: filtered.length });
  }),

  http.post(`${API_BASE}/investments`, async ({ request }) => {
    const body = await request.json() as Partial<Investment>;
    const newInv: Investment = {
      id: `inv-${Date.now()}`,
      name: body.name || "New Investment",
      asset_class: body.asset_class || "equity_mf",
      expected_cagr: body.expected_cagr || 12,
      start_date: body.start_date || new Date().toISOString().split("T")[0],
      is_active: true,
      latest_total_invested: 0,
      latest_current_value: 0,
      unrealized_gain: 0,
      absolute_return_pct: 0,
      latest_entry_month: null,
      notes: body.notes ?? null,
      linked_goals: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    investments.push(newInv);
    return HttpResponse.json(newInv, { status: 201 });
  }),

  http.get(`${API_BASE}/investments/:investmentId`, ({ params }) => {
    const inv = investments.find((i) => i.id === params.investmentId);
    if (!inv) {
      return HttpResponse.json(
        { data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Investment not found." } },
        { status: 404 },
      );
    }
    return HttpResponse.json(inv);
  }),

  http.put(`${API_BASE}/investments/:investmentId`, async ({ params, request }) => {
    const body = await request.json() as Partial<Investment>;
    const idx = investments.findIndex((i) => i.id === params.investmentId);
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Investment not found." } },
        { status: 404 },
      );
    }
    investments[idx] = { ...investments[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(investments[idx]);
  }),

  http.delete(`${API_BASE}/investments/:investmentId`, ({ params }) => {
    investments = investments.filter((i) => i.id !== params.investmentId);
    return new HttpResponse(null, { status: 204 });
  }),

  // ─── Monthly Entries ─────────────────────────────────────────────────────────
  http.get(`${API_BASE}/investments/:investmentId/entries`, ({ params }) => {
    const invEntries = entries[params.investmentId as string] || [];
    return HttpResponse.json({
      entries: invEntries,
      count: invEntries.length,
      investment_id: params.investmentId,
    });
  }),

  http.post(`${API_BASE}/investments/:investmentId/entries`, async ({ params, request }) => {
    const body = await request.json() as { entry_month: string; total_invested: number; current_value: number };
    const investmentId = params.investmentId as string;
    const existingEntries = entries[investmentId] || [];
    const existingIdx = existingEntries.findIndex((e) => e.entry_month === body.entry_month);

    const newEntry: MonthlyEntry = {
      id: `entry-${Date.now()}`,
      investment_id: investmentId,
      entry_month: body.entry_month,
      total_invested: body.total_invested,
      current_value: body.current_value,
      unrealized_gain: body.current_value - body.total_invested,
      absolute_return_pct:
        body.total_invested > 0
          ? ((body.current_value - body.total_invested) / body.total_invested) * 100
          : 0,
      month_over_month_value_change: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      existingEntries[existingIdx] = newEntry;
    } else {
      existingEntries.unshift(newEntry);
    }
    entries[investmentId] = existingEntries;

    return HttpResponse.json(newEntry, { status: existingIdx >= 0 ? 200 : 201 });
  }),

  // Bulk entry endpoint
  http.post(`${API_BASE}/entries/bulk`, async ({ request }) => {
    const body = await request.json() as { entry_month: string; entries: Array<{ investment_id: string; total_invested: number; current_value: number }> };
    const results = body.entries.map((e) => ({
      investment_id: e.investment_id,
      entry_month: body.entry_month,
      total_invested: e.total_invested,
      current_value: e.current_value,
      unrealized_gain: e.current_value - e.total_invested,
    }));
    return HttpResponse.json({ results, rag_changes: [] });
  }),
];

// Export a reset function for tests
export function resetMockData(): void {
  goals = [...MOCK_GOALS];
  investments = [...MOCK_INVESTMENTS];
  entries = { ...MOCK_ENTRIES };
}
