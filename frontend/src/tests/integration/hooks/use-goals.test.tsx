import React from "react";
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useGoals, useGoal } from "@/hooks/use-goals";
import { initializeApiClient } from "@/lib/api-client";

// Initialize the API client with a no-op token store for tests
initializeApiClient({
  accessToken: "mock-test-token",
  setAccessToken: () => {},
  refreshToken: async () => "new-token",
  onAuthFailure: () => {},
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useGoals", () => {
  it("fetches all goals successfully", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoals(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.goals).toBeDefined();
    expect(result.current.data?.goals.length).toBeGreaterThan(0);
  });

  it("returns goals with correct shape", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoals("active"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstGoal = result.current.data?.goals[0];
    expect(firstGoal).toHaveProperty("id");
    expect(firstGoal).toHaveProperty("name");
    expect(firstGoal).toHaveProperty("rag_status");
    expect(firstGoal).toHaveProperty("progress_pct");
  });

  it("includes all RAG statuses in mock data", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoals(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const ragStatuses = result.current.data?.goals.map((g) => g.rag_status) ?? [];
    expect(ragStatuses).toContain("green");
    expect(ragStatuses).toContain("amber");
    expect(ragStatuses).toContain("red");
    expect(ragStatuses).toContain("not_started");
  });
});

describe("useGoal", () => {
  it("fetches a single goal by ID", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoal("goal-001"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe("goal-001");
    expect(result.current.data?.name).toBe("Retirement Corpus");
  });

  it("returns 404 for non-existent goal", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGoal("non-existent"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
