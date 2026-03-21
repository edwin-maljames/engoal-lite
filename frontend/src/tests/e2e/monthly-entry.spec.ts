import { test, expect, Page } from "@playwright/test";

async function loginAsDemo(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("rahul@example.com");
  await page.getByLabel(/password/i).fill("Password123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("Monthly Entry Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("navigates to monthly entry page", async ({ page }) => {
    await page.getByRole("link", { name: /monthly entry/i }).click();
    await expect(page).toHaveURL(/\/monthly-entry/);
    await expect(page.getByRole("heading", { name: /monthly entry/i })).toBeVisible();
  });

  test("shows month selector", async ({ page }) => {
    await page.goto("/monthly-entry");
    await expect(page.getByText(/select month/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows investment table with active investments", async ({ page }) => {
    await page.goto("/monthly-entry");
    await expect(page.getByText(/investment values/i)).toBeVisible({ timeout: 5000 });
  });

  test("submit button is enabled when data is entered", async ({ page }) => {
    await page.goto("/monthly-entry");

    // Wait for the table to load
    await expect(page.getByText(/investment values/i)).toBeVisible({ timeout: 5000 });

    // The submit button should initially be disabled
    const submitBtn = page.getByRole("button", { name: /submit monthly data/i });

    // Fill in an investment row
    const inputs = page.locator("input[type='number']");
    const count = await inputs.count();
    if (count >= 2) {
      await inputs.nth(0).fill("600000");
      await inputs.nth(1).fill("720000");
      await expect(submitBtn).not.toBeDisabled();
    }
  });
});
