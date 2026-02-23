import type { RAGStatus, AssetClass } from "./goal";

export interface DashboardSummary {
  total_invested: number;
  total_invested_formatted: string;
  total_current_value: number;
  total_current_value_formatted: string;
  total_unrealized_gain: number;
  overall_return_pct: number;
  active_goals: number;
  goals_on_track: number;
  goals_at_risk: number;
}

export interface AssetAllocationItem {
  asset_class: AssetClass;
  current_value: number;
  allocation_pct: number;
  total_invested: number;
  unrealized_gain: number;
  investment_count: number;
}

export interface DashboardGoal {
  id: string;
  name: string;
  target_amount: number;
  target_amount_formatted: string;
  target_date: string;
  rag_status: RAGStatus;
  progress_pct: number;
  total_current_value: number;
}

export interface RecentEntry {
  investment_id: string;
  investment_name: string;
  entry_month: string;
  current_value: number;
  total_invested: number;
  created_at: string;
}

export interface Dashboard {
  summary: DashboardSummary;
  asset_allocation: AssetAllocationItem[];
  goals: DashboardGoal[];
  recent_entries: RecentEntry[];
}
