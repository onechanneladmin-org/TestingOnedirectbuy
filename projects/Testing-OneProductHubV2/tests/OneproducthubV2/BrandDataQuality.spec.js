import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand data quality", () => {
  test("brand can open the data quality dashboard", async ({ page, soft }) => {
    await soft("OPH-BRAND-DATA-QUALITY", "Open data quality dashboard", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Data Quality Dashboard");

      await expect(
        page.getByRole("heading", { name: /Data Quality/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
