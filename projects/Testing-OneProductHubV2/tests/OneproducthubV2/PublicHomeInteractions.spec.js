import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import { expectPublicHome, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — public home interactions", () => {
  test("visitor can use hero cards, capabilities, and cookie banner if shown", async ({
    page,
    soft,
  }) => {
    await soft("OPH-PUBLIC-HERO-CAROUSEL-1", "Hero carousel previous and next cards", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);
      await page.getByRole("button", { name: /Next card/i }).click();
      await page.getByRole("button", { name: /Previous card/i }).click();
      await expectPublicHome(page);
      await capturePageOrModal(page, "Public hero carousel");
    });

    await soft("OPH-PUBLIC-CAPABILITIES-1", "Brand and client capability sections", async () => {
      await expect(
        page.getByRole("heading", { name: /Create, control, and share/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByRole("heading", { name: /Request, receive, and sell/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Start Managing Product Data/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Request Brand Data Access/i }).first(),
      ).toBeVisible();
      await capturePageOrModal(page, "Public capabilities");
    });

    await soft("OPH-PUBLIC-COOKIE-1", "Cookie banner accept if present", async () => {
      const cookie = page.getByRole("button", {
        name: /accept( all)?( cookies)?|agree|got it/i,
      });
      if ((await cookie.count()) > 0 && (await cookie.first().isVisible().catch(() => false))) {
        await cookie.first().click();
      }
      await expectPublicHome(page);
      await capturePageOrModal(page, "Public cookie banner");
    });
  });
});
