import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import {
  clickFooterNav,
  expectPublicHome,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — public home search", () => {
  test("visitor can open home and search public policies", async ({
    page,
    soft,
  }) => {
    await soft("OPH-PUBLIC-HOME-1", "Open public home", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);
      await capturePageOrModal(page, "Public home");
    });

    await soft("OPH-PUBLIC-SEARCH-1", "Search public product catalog", async () => {
      // Marketing home no longer has a product catalog search bar.
      // Public searchable content now lives on the policies hub.
      await clickFooterNav(page, /^Privacy$/i);
      await expect(
        page.getByRole("heading", { name: /Policies & Legal Documents/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      const searchInput = page.getByRole("textbox", {
        name: /Search policies/i,
      });
      await expect(searchInput).toBeVisible({ timeout: STEP_TIMEOUT });
      await searchInput.fill("privacy");

      await expect(
        page.getByRole("button", { name: /Privacy Policy/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Public policy search results");
    });
  });
});
