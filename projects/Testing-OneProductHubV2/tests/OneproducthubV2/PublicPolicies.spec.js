import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import {
  clickFooterNav,
  expectPublicHome,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — public policies", () => {
  test("visitor can open privacy, terms, and legal policy pages", async ({
    page,
    soft,
  }) => {
    await soft("OPH-PUBLIC-POLICIES-HOME-1", "Open public home for policies", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);
    });

    await soft("OPH-PUBLIC-PRIVACY-1", "Open Privacy Policy", async () => {
      await clickFooterNav(page, /^Privacy$/i);
      await expect(
        page.getByRole("heading", { name: /Privacy Policy/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Privacy Policy page");
    });

    await soft("OPH-PUBLIC-TERMS-1", "Open Terms of Service", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);
      await clickFooterNav(page, /^Terms$/i);
      await expect(
        page
          .getByRole("heading", { name: /Terms of Service/i })
          .or(page.getByRole("button", { name: /Terms of Service/i }))
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Terms of Service page");
    });

    await soft("OPH-PUBLIC-LEGAL-1", "Open Legal & Policies", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);
      await clickFooterNav(page, /^Privacy$/i);
      await expect(
        page.getByRole("heading", { name: /Policies & Legal Documents/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByRole("button", { name: /Privacy Policy/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByRole("button", { name: /Terms of Service/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Legal & Policies page");
    });
  });

  test("visitor can open About from the footer", async ({ page, soft }) => {
    await soft("OPH-PUBLIC-ABOUT-1", "Open About from footer", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);
      await clickFooterNav(page, /^About$/i);

      await expect(
        page
          .getByRole("heading", { name: /product data|work for you/i })
          .or(page.getByText(/OneProductHub was born/i))
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "About Us page");
    });
  });
});
