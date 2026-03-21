import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api-client";
import { DASHBOARD_KEY } from "./use-dashboard";
import type { Investment, InvestmentCreate, InvestmentUpdate, AssetClass } from "@/types";

export const INVESTMENTS_KEY = ["investments"] as const;

export function useInvestments(filters?: { is_active?: boolean; asset_class?: AssetClass }) {
  return useQuery({
    queryKey: [...INVESTMENTS_KEY, filters],
    queryFn: () =>
      apiClient.get<{ investments: Investment[]; count: number }>("/investments", {
        ...(filters?.is_active !== undefined && { is_active: String(filters.is_active) }),
        ...(filters?.asset_class && { asset_class: filters.asset_class }),
      }),
  });
}

export function useInvestment(investmentId: string) {
  return useQuery({
    queryKey: [...INVESTMENTS_KEY, investmentId],
    queryFn: () => apiClient.get<Investment>(`/investments/${investmentId}`),
    enabled: !!investmentId,
  });
}

export function useCreateInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InvestmentCreate) => apiClient.post<Investment>("/investments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Investment created successfully.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create investment.");
    },
  });
}

export function useUpdateInvestment(investmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InvestmentUpdate) =>
      apiClient.put<Investment>(`/investments/${investmentId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Investment updated successfully.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update investment.");
    },
  });
}

export function useDeactivateInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (investmentId: string) =>
      apiClient.put(`/investments/${investmentId}`, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Investment deactivated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to deactivate investment.");
    },
  });
}
