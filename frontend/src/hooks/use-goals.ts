import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";
import { DASHBOARD_KEY } from "./use-dashboard";
import type { Goal, GoalCreate, GoalUpdate, GoalProjection, GoalStatus } from "@/types";

export const GOALS_KEY = ["goals"] as const;

export function useGoals(status?: GoalStatus) {
  return useQuery({
    queryKey: [...GOALS_KEY, { status }],
    queryFn: () =>
      apiClient.get<{ goals: Goal[]; count: number }>("/goals", status ? { status } : undefined),
  });
}

export function useGoal(goalId: string) {
  return useQuery({
    queryKey: [...GOALS_KEY, goalId],
    queryFn: () => apiClient.get<Goal>(`/goals/${goalId}`),
    enabled: !!goalId,
  });
}

export function useGoalProjection(goalId: string) {
  return useQuery({
    queryKey: [...GOALS_KEY, goalId, "projection"],
    queryFn: () => apiClient.get<GoalProjection>(`/goals/${goalId}/projection`),
    enabled: !!goalId,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GoalCreate) => apiClient.post<Goal>("/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Goal created successfully.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create goal.");
    },
  });
}

export function useUpdateGoal(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GoalUpdate) => apiClient.put<Goal>(`/goals/${goalId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Goal updated successfully.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update goal.");
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => apiClient.delete(`/goals/${goalId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Goal removed.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to remove goal.");
    },
  });
}

export function useLinkInvestment(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { investment_id: string; allocation_pct: number }) =>
      apiClient.post(`/goals/${goalId}/investments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Investment linked to goal.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to link investment.");
    },
  });
}

export function useUnlinkInvestment(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (investmentId: string) =>
      apiClient.delete(`/goals/${goalId}/investments/${investmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      toast.success("Investment unlinked.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to unlink investment.");
    },
  });
}
