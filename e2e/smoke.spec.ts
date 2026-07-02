import { test, expect } from "@playwright/test";

/**
 * Smoke test: hit the home page, take the Plan Now survey, land on
 * /compare with a ranked view.
 *
 * Prerequisites: `bun run dev` running on http://localhost:3000 with
 * a valid .env.local. Does NOT require Supabase auth — every route
 * exercised here is public.
 */

test.describe("TripWise smoke", () => {
  test("home renders with planning-depth cards + featured destinations", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Plan the trip/i }),
    ).toBeVisible();

    // The three planning depths.
    await expect(page.getByText("Plan Now", { exact: true })).toBeVisible();
    await expect(page.getByText("Intermediate")).toBeVisible();
    await expect(page.getByText("Deep Research")).toBeVisible();

    // The three seeded destinations.
    await expect(
      page.getByRole("link", { name: /Bangkok, Thailand/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Prague, Czech Republic/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /South Italy, Italy/i }),
    ).toBeVisible();
  });

  test("Plan Now survey → compare ranks the destinations", async ({
    page,
  }) => {
    await page.goto("/survey/plan_now");

    await expect(
      page.getByRole("heading", { name: /Tell us about the trip/i }),
    ).toBeVisible();

    // The default form has all three candidates selected and sensible
    // dates. Just submit and check the ranked view.
    const submit = page.getByRole("button", {
      name: /Rank the destinations/i,
    });
    await expect(submit).toBeEnabled();
    await submit.click();

    // /compare shows the "Ranked for you" title.
    await expect(page).toHaveURL(/\/compare\?intent=/);
    await expect(
      page.getByRole("heading", { name: /Ranked for you/i }),
    ).toBeVisible();

    // At least one rank card should be visible.
    await expect(page.getByText(/Rank #1/i)).toBeVisible();
  });

  test("compare view is usable on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/compare");
    await expect(
      page.getByRole("heading", { name: /Compare — autumn 2026/i }),
    ).toBeVisible();

    // No horizontal overflow on the outer main container.
    // (The comparison table is inside overflow-x-auto by design.)
    const main = page.locator("main").first();
    const box = await main.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(376);
  });

  test("destination detail loads with hero + cost breakdown", async ({
    page,
  }) => {
    await page.goto("/destinations/prague");

    await expect(
      page.getByRole("heading", { name: /Prague/i }),
    ).toBeVisible();

    // AI hero image label is present.
    await expect(
      page.getByText(/AI-generated hero.*Nano Banana/i),
    ).toBeVisible();

    // Cost breakdown sidebar.
    await expect(page.getByText(/Estimated total/i)).toBeVisible();
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "TripWise", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Send magic link/i }),
    ).toBeVisible();
  });
});
