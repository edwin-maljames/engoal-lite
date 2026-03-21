import { test, expect, Page } from "@playwright/test";

async function loginAsDemo(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("rahul@example.com");
  await page.getByLabel(/password/i).fill("Password123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("Goals CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("shows goals list page", async ({ page }) => {
    await page.goto("/goals");
    await expect(page.getByRole("heading", { name: /goals/i })).toBeVisible();
  });

  test("shows goal cards with RAG badges", async ({ page }) => {
    await page.goto("/goals");
    // Goals should be visible with badges
    await expect(page.getByText(/on track|slightly behind|significantly behind|not started/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("navigates to new goal form", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("link", { name: /new goal/i }).click();
    await expect(page).toHaveURL(/\/goals\/new/);
    await expect(page.getByLabel(/goal name/i)).toBeVisible();
  });

  test("creates a new goal", async ({ page }) => {
    await page.goto("/goals/new");

    const futureYear = new Date().getFullYear() + 3;
    await page.getByLabel(/goal name/i).fill("E2E Test Goal");
    await page.getByLabel(/target amount/i).fill("2000000");
    await page.getByLabel(/target date/i).fill(`${futureYear}-06`);

    await page.getByRole("button", { name: /create goal/i }).click();

    // Should redirect to goal detail
    await expect(page).toHaveURL(/\/goals\/goal-/, { timeout: 10000 });
  });

  test("navigates to goal detail page", async ({ page }) => {
    await page.goto("/goals");
    const firstGoalLink = page.locator("a[href^='/goals/goal-']").first();
    await firstGoalLink.click();
    await expect(page).toHaveURL(/\/goals\/goal-/);
  });
});
