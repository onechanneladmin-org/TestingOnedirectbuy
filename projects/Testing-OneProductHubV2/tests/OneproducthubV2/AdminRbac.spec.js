import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin RBAC", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("admin can open RBAC access page", async ({ page, soft }) => {
    await soft("OPH-ADMIN-RBAC", "Open RBAC access page", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "RBAC Access");

      await expect(
        page.getByRole("heading", { name: /RBAC|Access|Permission|Role/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByText(/user|role|permission|search/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
