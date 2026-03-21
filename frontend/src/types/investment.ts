import type { AssetClass } from "./goal";

export interface Investment {
  id: string;
  name: string;
  asset_class: AssetClass;
  expected_cagr: number;
  start_date: string;
  is_active: boolean;
  latest_total_invested: number;
  latest_current_value: number;
  unrealized_gain: number;
  absolute_return_pct: number;
  latest_entry_month: string | null;
  notes: string | null;
  linked_goals: LinkedGoal[];
  created_at: string;
  updated_at: string;
}

export interface LinkedGoal {
  goal_id: string;
  goal_name: string;
  allocation_pct: number;
}

export interface GoalInvestmentLink {
  id: string;
  goal_id: string;
  investment_id: string;
  allocation_pct: number;
  created_at: string;
}

export interface InvestmentCreate {
  name: string;
  asset_class: AssetClass;
  expected_cagr: number;
  start_date: string;
  notes?: string;
}

export interface InvestmentUpdate {
  name?: string;
  expected_cagr?: number;
  is_active?: boolean;
  notes?: string;
  start_date?: string;
}

export interface LinkInvestmentToGoal {
  investment_id: string;
  allocation_pct: number;
}
