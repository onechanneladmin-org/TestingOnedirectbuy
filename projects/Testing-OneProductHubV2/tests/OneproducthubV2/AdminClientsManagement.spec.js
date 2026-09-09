import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin clients management", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("admin can open clients management", async ({ page, soft }) => {
    await soft("OPH-ADMIN-CLIENTS", "Open clients management", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Clients");

      await expect(
        page.getByRole("heading", { name: /Client/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByText(/approve|deny|pending|client|customer|search/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
