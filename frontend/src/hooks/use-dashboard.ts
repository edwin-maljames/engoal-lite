import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Dashboard } from "@/types";

export const DASHBOARD_KEY = ["dashboard"] as const;

export function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => apiClient.get<Dashboard>("/dashboard"),
  });
}
