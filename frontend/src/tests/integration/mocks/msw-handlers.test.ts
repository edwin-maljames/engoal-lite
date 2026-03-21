import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";

describe("MSW Server", () => {
  it("is set up and running", () => {
    // Server is started in setup.ts via beforeAll
    expect(server).toBeDefined();
  });
});

describe("API handlers coverage", () => {
  it("handles auth endpoints", async () => {
    const res = await fetch("http://localhost:8000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rahul@example.com", password: "Password123!" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.access_token).toBeDefined();
  });

  it("rejects invalid credentials with 401", async () => {
    const res = await fetch("http://localhost:8000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "wrong@example.com", password: "wrongpass" }),
    });
    expect(res.status).toBe(401);
  });

  it("handles goals list endpoint", async () => {
    const res = await fetch("http://localhost:8000/api/v1/goals", {
      headers: { Authorization: "Bearer mock-token" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.goals).toBeDefined();
    expect(Array.isArray(data.goals)).toBe(true);
  });

  it("handles investments list endpoint", async () => {
    const res = await fetch("http://localhost:8000/api/v1/investments", {
      headers: { Authorization: "Bearer mock-token" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.investments).toBeDefined();
  });

  it("handles dashboard endpoint", async () => {
    const res = await fetch("http://localhost:8000/api/v1/dashboard", {
      headers: { Authorization: "Bearer mock-token" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBeDefined();
    expect(data.asset_allocation).toBeDefined();
  });

  it("creates a goal via POST", async () => {
    const res = await fetch("http://localhost:8000/api/v1/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer mock-token" },
      body: JSON.stringify({
        name: "Test Goal",
        target_amount: 1000000,
        target_date: "2035-01-01",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.name).toBe("Test Goal");
  });

  it("returns 404 for non-existent goal", async () => {
    const res = await fetch("http://localhost:8000/api/v1/goals/non-existent-id", {
      headers: { Authorization: "Bearer mock-token" },
    });
    expect(res.status).toBe(404);
  });

  it("handles bulk entry submission", async () => {
    const res = await fetch("http://localhost:8000/api/v1/entries/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer mock-token" },
      body: JSON.stringify({
        entry_month: "2026-02-01",
        entries: [
          { investment_id: "inv-001", total_invested: 600000, current_value: 720000 },
        ],
      }),
    });
    expect(res.status).toBe(200);
  });
});
