import React from "react";
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useInvestments } from "@/hooks/use-investments";
import { initializeApiClient } from "@/lib/api-client";

initializeApiClient({
  accessToken: "mock-test-token",
  setAccessToken: () => {},
  refreshToken: async () => "new-token",
  onAuthFailure: () => {},
});

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function W({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useInvestments", () => {
  it("fetches active investments", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInvestments({ is_active: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.investments.length).toBeGreaterThan(0);
    result.current.data?.investments.forEach((inv) => {
      expect(inv.is_active).toBe(true);
    });
  });

  it("includes smallcase asset class in results", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInvestments(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const assetClasses = result.current.data?.investments.map((i) => i.asset_class) ?? [];
    expect(assetClasses).toContain("smallcase");
  });

  it("investment has linked_goals array", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInvestments(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstInv = result.current.data?.investments[0];
    expect(firstInv).toHaveProperty("linked_goals");
    expect(Array.isArray(firstInv?.linked_goals)).toBe(true);
  });
});
