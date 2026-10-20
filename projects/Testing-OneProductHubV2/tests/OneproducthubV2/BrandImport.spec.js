import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand import", () => {
  test("brand can open the import center", async ({ page, soft }) => {
    await soft("OPH-BRAND-IMPORT", "Open brand import center", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Import Center");

      await expect(
        page.getByRole("heading", { name: /Import/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByText(/upload|file|csv|import|map/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
