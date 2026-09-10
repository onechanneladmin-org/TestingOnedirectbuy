import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import { expectPublicHome, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — public Start Free", () => {
  test("Start Free opens client B2B registration", async ({ page, soft }) => {
    await soft("OPH-PUBLIC-START-FREE-1", "Start Free opens client signup", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);
      await page.getByRole("button", { name: /^Start Free$/i }).first().click();

      await expect(
        page.getByRole("heading", { name: /Create Client Account|Create Brand Account/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByRole("button", { name: /Submit B2B Registration|Create Account/i }),
      ).toBeVisible();
      await capturePageOrModal(page, "Start Free signup");
    });
  });
});
