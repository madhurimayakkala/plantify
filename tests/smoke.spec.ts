// tests/smoke.spec.ts
import { test, expect } from "@playwright/test";

/**
 * Smoke test for Plantify's core loop:
 *   Continue as Guest -> Create a workload -> Complete a task
 *   -> End cycle (Save & Reset) -> See it in the Garden
 *
 * This runs in a completely fresh browser profile (no cookies, no
 * localStorage), so it doubles as a check that a brand-new visitor
 * always sees the Welcome screen first.
 */
test("guest can complete the full create -> progress -> end cycle -> garden flow", async ({
  page,
}) => {
  // 1. Visit the homepage as a fresh visitor
  await page.goto("/");

  // 2. The Welcome screen should show first (not the dashboard) since
  //    this is a brand-new browser profile with no guest flag set yet.
  await expect(
    page.getByRole("button", { name: "Continue as Guest" })
  ).toBeVisible();

  // 3. Continue as guest
  await page.getByRole("button", { name: "Continue as Guest" }).click();

  // 4. Since a fresh guest has no active workload, the "New Workload"
  //    modal should open automatically.
  await expect(
    page.getByRole("heading", { name: "New Workload" })
  ).toBeVisible();

  // Fill in the workload name
  await page.getByLabel("Workload Name").fill("Test Prep");

  // Fill in the first (and only) task
  await page.getByLabel("Task 1 name").fill("Read chapter 1");
  await page.getByLabel("Task 1 total").fill("1");

  // Submit the form
  await page.getByRole("button", { name: "Plant Seed" }).click();

  // 5. The modal should close, and the dashboard should now show our
  //    workload name and the "End Cycle" button (only present once a
  //    workload exists).
  //
  //    Note: "Test Prep" appears twice on the dashboard (once as plain
  //    text under the plant emoji, once as a heading in the workload
  //    panel), so we target the heading specifically to avoid ambiguity.
  await expect(
    page.getByRole("heading", { name: "New Workload" })
  ).not.toBeVisible();

  await expect(page.getByRole("heading", { name: "Test Prep" })).toBeVisible();

  await expect(page.getByRole("button", { name: "End Cycle" })).toBeVisible();

  // 6. Mark the one task complete by clicking its "+" button once
  //    (total is 1, so one click reaches 100%).
  await page
    .getByRole("button", { name: "Increase Read chapter 1 progress" })
    .click();

  // Water percentage should now show 100%.
  //
  // Note: several elements on the page contain the substring "100%"
  // (e.g. "Read chapter 1: 100%", "1 / 1 completed · 100%"), so we use
  // exact: true to match only the standalone "100%" water counter.
  await expect(page.getByText("100%", { exact: true })).toBeVisible();

  // 7. End the cycle and choose "Save & Reset"
  await page.getByRole("button", { name: "End Cycle" }).click();

  await expect(page.getByRole("heading", { name: "End Cycle" })).toBeVisible();

  await page.getByRole("button", { name: "Save & Reset" }).click();

  // A success toast should confirm the plant was saved
  await expect(page.getByText("Saved to your garden!")).toBeVisible();

  // 8. Go to the Garden page and confirm the plant is actually there
  await page.goto("/garden");

  await expect(
    page.getByRole("heading", { name: "Your Garden" })
  ).toBeVisible();

  await expect(page.getByText("Test Prep")).toBeVisible();
});
