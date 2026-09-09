import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand export", () => {
  test("brand can open the export center", async ({ page, soft }) => {
    await soft("OPH-BRAND-EXPORT", "Open brand export center", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Export Center");

      await expect(
        page.getByRole("heading", { name: /Export/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByText(/CSV|JSON|export|format|field/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
