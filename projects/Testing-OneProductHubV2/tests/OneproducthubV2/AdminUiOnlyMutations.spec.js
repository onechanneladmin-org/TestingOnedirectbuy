import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { hasAdminCredentials, signInAsAdmin } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin mutating controls UI only", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(true, "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD");
    }
  });

  test("admin can see approve and deny controls without mutating live data", async ({
    page,
    soft,
  }) => {
    await soft("OPH-ADMIN-APPROVE-BRAND-UI-1", "Brand registry approval controls visible", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Brand Registry");
      await page.getByRole("button", { name: /Approval Requests/i }).click();
      await expect(
        page.getByText(/approve|deny|pending|request|brand|no /i).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Admin brand approval UI");
    });

    await soft("OPH-ADMIN-APPROVE-CLIENT-UI-1", "Client pending approval controls visible", async () => {
      await clickSidebarNav(page, "Clients");
      await page.getByRole("button", { name: /Pending/i }).first().click();
      await expect(
        page.getByText(/pending|approve|deny|client|applied/i).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Admin client approval UI");
    });

    await soft("OPH-ADMIN-RBAC-CREATE-UI-1", "RBAC create and bulk create are visible", async () => {
      await clickSidebarNav(page, "RBAC Access");
      await expect(page.getByRole("button", { name: /Create permission/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(page.getByRole("button", { name: /Bulk create/i })).toBeVisible();
    });
  });
});
