import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin blog and guides", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(true, "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD");
    }
  });

  test("admin can open Blog & Guides from the sidebar", async ({ page, soft }) => {
    await soft("OPH-ADMIN-BLOG-1", "Open admin Blog & Guides", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Blog & Guides");
      await expect(
        page
          .getByRole("heading", { name: /blog|guide|article|insight|resource/i })
          .or(page.getByText(/blog|guides|articles/i).first())
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Admin Blog & Guides");
    });
  });
});
