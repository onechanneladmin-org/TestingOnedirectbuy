import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";

test.describe("One Product Hub V2 — admin authentication", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("superadmin can sign in via brand path and reach admin portal", async ({
    page,
    soft,
  }) => {
    await soft("OPH-LOGIN-ADMIN-1", "Admin sign-in reaches Admin Dashboard", async () => {
      await signInAsAdmin(page);
      await expect(
        page.getByRole("heading", { name: "Admin Dashboard" })
      ).toBeVisible();
      await expect(page.getByText("Superadmin").first()).toBeVisible();
    });
  });
});
