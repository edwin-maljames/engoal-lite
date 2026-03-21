import { test, expect, Page } from "@playwright/test";

async function loginAsDemo(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("rahul@example.com");
  await page.getByLabel(/password/i).fill("Password123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("shows portfolio summary cards", async ({ page }) => {
    await expect(page.getByText(/total invested/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/current value/i)).toBeVisible();
  });

  test("shows goals section with RAG badges", async ({ page }) => {
    await expect(page.getByText(/goals/i).first()).toBeVisible();
    // Should show at least one goal card
    const goalLinks = page.locator("a[href^='/goals/']");
    await expect(goalLinks.first()).toBeVisible({ timeout: 5000 });
  });

  test("navigation links work", async ({ page }) => {
    await page.getByRole("link", { name: /goals/i }).first().click();
    await expect(page).toHaveURL(/\/goals/);
  });

  test("shows sidebar navigation", async ({ page }) => {
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText("Investments")).toBeVisible();
    await expect(page.getByText("Monthly Entry")).toBeVisible();
  });
});
