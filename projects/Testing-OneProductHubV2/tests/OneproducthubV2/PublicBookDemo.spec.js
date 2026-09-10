import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import { expectPublicHome, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — public Book a Demo", () => {
  test("Book a Demo opens a demo request surface", async ({ page, soft }) => {
    await soft("OPH-PUBLIC-BOOK-DEMO-1", "Book a Demo CTA is reachable", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expectPublicHome(page);
      await page.getByRole("button", { name: /^Book a Demo$/i }).first().click();

      await expect(
        page
          .getByRole("heading", { name: /demo|book|schedule|contact|talk/i })
          .or(page.getByRole("textbox", { name: /email|name/i }))
          .or(page.getByText(/book a demo|schedule|calendly|hubspot/i))
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Book a Demo");
    });
  });
});
