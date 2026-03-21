export type RAGStatus = "green" | "amber" | "red" | "not_started";

export type GoalStatus = "active" | "achieved" | "abandoned";

export type GoalPriority = "HIGH" | "MEDIUM" | "LOW";

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  target_amount_formatted: string;
  target_date: string; // ISO date YYYY-MM-DD
  status: GoalStatus;
  priority: GoalPriority;
  rag_status: RAGStatus;
  total_invested: number;
  total_current_value: number;
  total_projected_value: number;
  progress_pct: number;
  investment_count: number;
  created_at: string;
  updated_at: string;
}

export interface GoalCreate {
  name: string;
  description?: string;
  target_amount: number;
  target_date: string;
  priority?: GoalPriority;
}

export interface GoalUpdate {
  name?: string;
  description?: string;
  target_amount?: number;
  target_date?: string;
  status?: GoalStatus;
  priority?: GoalPriority;
}

export interface GoalProjection {
  goal_id: string;
  goal_name: string;
  target_amount: number;
  target_date: string;
  years_remaining: number;
  investments: InvestmentProjectionItem[];
  total_current_value: number;
  total_projected_value: number;
  progress_pct: number;
  rag_status: RAGStatus;
  shortfall: number;
  shortfall_formatted: string;
  recommended_monthly_sip: number | null;
}

export interface InvestmentProjectionItem {
  id: string;
  name: string;
  asset_class: AssetClass;
  latest_value: number;
  expected_cagr: number;
  projected_value: number;
  allocation_pct: number;
}

export type AssetClass =
  | "equity_mf"
  | "debt_mf"
  | "fixed_deposit"
  | "gold"
  | "real_estate"
  | "smallcase";
