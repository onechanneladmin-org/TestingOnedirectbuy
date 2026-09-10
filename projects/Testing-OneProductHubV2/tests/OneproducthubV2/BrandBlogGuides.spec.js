import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand blog and guides", () => {
  test("brand can open Blog & Guides from the sidebar", async ({ page, soft }) => {
    await soft("OPH-BRAND-BLOG-1", "Open brand Blog & Guides", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Blog & Guides");
      await expect(
        page
          .getByRole("heading", { name: /blog|guide|article|insight|resource/i })
          .or(page.getByText(/blog|guides|articles/i).first())
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Brand Blog & Guides");
    });
  });
});
