import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin platform dashboard", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("admin sees platform overview on dashboard", async ({ page, soft }) => {
    await soft("OPH-ADMIN-DASHBOARD", "Admin platform dashboard overview", async () => {
      await signInAsAdmin(page);
      await expect(
        page.getByRole("heading", { name: "Admin Dashboard" })
      ).toBeVisible();
      await expect(
        page.getByText(/Platform overview|Active brands|Platform users/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
