import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client dashboard", () => {
  test("client dashboard shows welcome and brand access summary", async ({
    page,
    soft,
  }) => {
    await soft("OPH-CLIENT-DASHBOARD", "Client dashboard welcome overview", async () => {
      await signInAsClient(page);

      await expect(
        page.getByRole("heading", { name: /Welcome back,/i })
      ).toBeVisible();
      await expect(page.getByText(/Brands you can access/i)).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(
        page.getByRole("button", { name: /View brands/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });

  test("client can navigate to brand directory from dashboard", async ({
    page,
    soft,
  }) => {
    await soft("OPH-CLIENT-DASHBOARD-NAV", "Navigate to brand directory from dashboard", async () => {
      await signInAsClient(page);
      await page.getByRole("button", { name: /View brands/i }).first().click();

      await expect(
        page.getByRole("heading", { name: "Brand Directory" })
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
