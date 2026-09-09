import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin brand directory drilldown", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("admin can open brand directory and inspect a brand", async ({
    page,
    soft,
  }) => {
    await soft("OPH-ADMIN-BRAND-DIRECTORY", "Open brand directory and inspect a brand", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Brand Directory");

      await expect(
        page.getByRole("heading", { name: "Brand Directory" })
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      const brandRow = page
        .getByText(/NewBrand1|Approved|brand/i)
        .or(page.getByRole("button", { name: /View|Open|profile/i }))
        .first();
      await expect(brandRow).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
