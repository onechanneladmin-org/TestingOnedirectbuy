import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — public policies", () => {
  test("visitor can open privacy, terms, and legal policy pages", async ({
    page,
    soft,
  }) => {
    await soft("OPH-PUBLIC-POLICIES-HOME-1", "Open public home for policies", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expect(
        page.getByRole("heading", { name: "Find Product Information" })
      ).toBeVisible();
    });

    await soft("OPH-PUBLIC-PRIVACY-1", "Open Privacy Policy", async () => {
      await page.getByRole("button", { name: "Privacy Policy" }).click();
      await expect(page.getByText(/privacy/i).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await capturePageOrModal(page, "Privacy Policy page");
    });

    await soft("OPH-PUBLIC-TERMS-1", "Open Terms of Service", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await page.getByRole("button", { name: "Terms of Service" }).click();
      await expect(page.getByText(/terms/i).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await capturePageOrModal(page, "Terms of Service page");
    });

    await soft("OPH-PUBLIC-LEGAL-1", "Open Legal & Policies", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await page.getByRole("button", { name: "Legal & Policies" }).click();
      await expect(page.getByText(/polic/i).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await capturePageOrModal(page, "Legal & Policies page");
    });
  });

  test("visitor can open About from the footer", async ({ page, soft }) => {
    await soft("OPH-PUBLIC-ABOUT-1", "Open About from footer", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await page.getByRole("button", { name: "About" }).click();

      await expect(
        page
          .getByRole("heading", { name: /product data|work for you/i })
          .or(page.getByText(/OneProductHub was born/i))
          .first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "About Us page");
    });
  });
});
