import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import {
  clickFooterNav,
  expectPublicHome,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — public pricing and FAQ", () => {
  test("visitor can open pricing plans from footer", async ({ page, soft }) => {
    await soft("OPH-PUBLIC-PRICING-1", "Open public pricing plans", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);
      await clickFooterNav(page, /^Pricing$/i);

      await expect(
        page
          .getByRole("heading", { name: /pricing|plan|starter|growth|scale/i })
          .or(page.getByRole("button", { name: /Choose Starter|Choose Growth/i }))
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByRole("button", { name: /Choose Starter|Choose Growth|Contact Support/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Public pricing");
    });
  });

  test("visitor can expand a home FAQ item", async ({ page, soft }) => {
    await soft("OPH-PUBLIC-FAQ-1", "Expand public FAQ accordion", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);

      const question = page.getByRole("button", { name: /What is OneProductHub/i });
      await expect(question).toBeVisible({ timeout: STEP_TIMEOUT });
      await question.scrollIntoViewIfNeeded();
      await question.click();

      await expect(
        page.getByText(/product data|enrich|brand|client|platform/i).nth(1),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "FAQ expanded");
    });
  });
});
