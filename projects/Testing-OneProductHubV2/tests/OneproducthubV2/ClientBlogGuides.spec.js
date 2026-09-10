import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client blog and guides", () => {
  test("client can open Blog & Guides from the sidebar", async ({ page, soft }) => {
    await soft("OPH-CLIENT-BLOG-1", "Open client Blog & Guides", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Blog & Guides");
      await expect(
        page
          .getByRole("heading", { name: /blog|guide|article|insight|resource/i })
          .or(page.getByText(/blog|guides|articles/i).first())
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Client Blog & Guides");
    });
  });
});
