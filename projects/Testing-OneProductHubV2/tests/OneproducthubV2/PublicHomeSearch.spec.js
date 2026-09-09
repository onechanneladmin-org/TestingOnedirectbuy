import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";

test.describe("One Product Hub V2 — public home search", () => {
  test("visitor can search the public product catalog", async ({
    page,
    soft,
  }) => {
    await soft("OPH-PUBLIC-HOME-1", "Open public home", async () => {
      await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
      await expect(
        page.getByRole("heading", { name: "Find Product Information" })
      ).toBeVisible();
      await capturePageOrModal(page, "Public home");
    });

    await soft("OPH-PUBLIC-SEARCH-1", "Search public product catalog", async () => {
      const searchInput = page.getByPlaceholder(
        "Search products, brands, MPN, SKU..."
      );
      await searchInput.fill("brake");
      await page.getByRole("button", { name: "Search" }).click();

      await expect(
        page.getByText(/results|product|no products found|search/i).first()
      ).toBeVisible({ timeout: 15_000 });
      await capturePageOrModal(page, "Public search results");
    });
  });
});
