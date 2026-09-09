import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  navigateToHash,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand settings", () => {
  test("brand can open settings and reach profile section", async ({ page, soft }) => {
    await soft("OPH-BRAND-SETTINGS", "Open brand settings", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Settings");

      await expect(
        page.getByText(/Settings|Profile|Account|Security/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });

  test("brand can deep-link settings profile section", async ({ page, soft }) => {
    await soft("OPH-BRAND-SETTINGS-PROFILE", "Deep-link brand settings profile", async () => {
      await signInAsBrand(page);
      await navigateToHash(page, "settings?section=profile");

      await expect(page).toHaveURL(/#\/settings/, { timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(
        page.getByRole("heading", { name: /Settings/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
