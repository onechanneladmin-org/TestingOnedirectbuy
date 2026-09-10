import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
  signInAsBrand,
} from "../helpers/oneProductHubV2Auth.js";
import { signOut } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand and admin sign out", () => {
  test("brand can sign out and return to the public home page", async ({ page, soft }) => {
    await soft("OPH-LOGOUT-BRAND-1", "Brand sign-out returns to public home", async () => {
      await signInAsBrand(page);
      await signOut(page);
      await expect(page.getByRole("button", { name: /^log\s*in$/i })).toBeVisible();
    });
  });

  test("admin can sign out and return to the public home page", async ({ page, soft }) => {
    test.skip(
      !hasAdminCredentials(),
      "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD",
    );
    await soft("OPH-LOGOUT-ADMIN-1", "Admin sign-out returns to public home", async () => {
      await signInAsAdmin(page);
      await signOut(page);
      await expect(page.getByRole("button", { name: /^log\s*in$/i })).toBeVisible();
    });
  });
});
