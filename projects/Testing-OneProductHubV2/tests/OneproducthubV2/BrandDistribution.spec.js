import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand distribution", () => {
  test("brand can open distributions / channel sync", async ({ page, soft }) => {
    await soft("OPH-BRAND-DISTRIBUTION", "Open distributions / channel sync", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Distributions");

      await expect(
        page.getByRole("heading", { name: /Distribution|Channel/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByText(/channel|sync|distribution/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
