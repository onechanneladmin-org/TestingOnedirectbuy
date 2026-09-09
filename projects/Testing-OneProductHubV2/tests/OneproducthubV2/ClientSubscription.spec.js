import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client subscription", () => {
  test("client can view subscription plans", async ({ page, soft }) => {
    await soft("OPH-CLIENT-SUBSCRIPTION", "View client subscription plans", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Subscription");

      await expect(
        page.getByRole("heading", { name: /Subscription|Plan/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByText(/plan|trial|billing|free|subscribe/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
