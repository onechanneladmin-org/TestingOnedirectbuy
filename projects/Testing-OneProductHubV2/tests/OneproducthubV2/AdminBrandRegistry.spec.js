import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin brand registry", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("admin can open brand registry with review controls", async ({
    page,
    soft,
  }) => {
    await soft("OPH-ADMIN-BRAND-REGISTRY", "Open brand registry with review controls", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Brand Registry");

      await expect(
        page.getByRole("heading", { name: /Brand Registry|Brand/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByText(/approve|deny|revoke|pending|brand|search/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
