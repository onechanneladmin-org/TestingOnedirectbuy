import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand subscription", () => {
  test("brand can view subscription plans without completing checkout", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-SUBSCRIPTION", "View brand subscription plans", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Subscription");

      await expect(
        page.getByRole("heading", { name: /Subscription|Plan/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByText(/plan|trial|billing|subscribe|free/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
