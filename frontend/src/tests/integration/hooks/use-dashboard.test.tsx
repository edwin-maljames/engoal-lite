import React from "react";
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDashboard } from "@/hooks/use-dashboard";
import { initializeApiClient } from "@/lib/api-client";

initializeApiClient({
  accessToken: "mock-test-token",
  setAccessToken: () => {},
  refreshToken: async () => "new-token",
  onAuthFailure: () => {},
});

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function W({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useDashboard", () => {
  it("fetches dashboard data with summary", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data?.summary).toBeDefined();
    expect(typeof data?.summary.total_invested).toBe("number");
    expect(typeof data?.summary.total_current_value).toBe("number");
    expect(typeof data?.summary.total_unrealized_gain).toBe("number");
  });

  it("dashboard includes asset allocation with smallcase", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const allocation = result.current.data?.asset_allocation ?? [];
    const assetClasses = allocation.map((a) => a.asset_class);
    expect(assetClasses).toContain("smallcase");
  });

  it("dashboard includes goals list", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data?.goals)).toBe(true);
    expect(result.current.data?.goals.length).toBeGreaterThan(0);
  });

  it("dashboard includes recent entries", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data?.recent_entries)).toBe(true);
  });
});
