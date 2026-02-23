import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { DASHBOARD_KEY } from "./use-dashboard";
import { GOALS_KEY } from "./use-goals";
import type { MonthlyEntry, EntryCreate, BulkEntrySubmit } from "@/types";

export const ENTRIES_KEY = ["entries"] as const;

export function useEntries(investmentId: string) {
  return useQuery({
    queryKey: [...ENTRIES_KEY, investmentId],
    queryFn: () =>
      apiClient.get<{ entries: MonthlyEntry[]; count: number; investment_id: string }>(
        `/investments/${investmentId}/entries`,
      ),
    enabled: !!investmentId,
  });
}

export function useCreateEntry(investmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: EntryCreate) =>
      apiClient.post<MonthlyEntry>(`/investments/${investmentId}/entries`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ENTRIES_KEY, investmentId] });
      queryClient.invalidateQueries({ queryKey: ["investments", investmentId] });
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Monthly entry saved.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to save entry.");
    },
  });
}

export function useSubmitBulkEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkEntrySubmit) => apiClient.post("/entries/bulk", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Monthly data submitted successfully.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to submit monthly data.");
    },
  });
}
