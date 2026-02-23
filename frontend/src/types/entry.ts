export interface MonthlyEntry {
  id: string;
  investment_id: string;
  entry_month: string; // YYYY-MM-01
  total_invested: number;
  current_value: number;
  unrealized_gain: number;
  absolute_return_pct: number;
  month_over_month_value_change: number | null;
  created_at: string;
  updated_at: string;
}

export interface EntryCreate {
  entry_month: string; // YYYY-MM-01
  total_invested: number;
  current_value: number;
}

export interface BulkEntryItem {
  investment_id: string;
  total_invested: number;
  current_value: number;
}

export interface BulkEntrySubmit {
  entry_month: string;
  entries: BulkEntryItem[];
}
