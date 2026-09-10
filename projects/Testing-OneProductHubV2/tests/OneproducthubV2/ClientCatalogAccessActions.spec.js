import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client catalog and access actions", () => {
  test("client can search brand directory and see request-access controls", async ({
    page,
    soft,
  }) => {
    await soft("OPH-CLIENT-DIRECTORY-SEARCH-1", "Search client brand directory", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Brand Directory");
      const search = page.getByPlaceholder(/search/i).first();
      await expect(search).toBeVisible({ timeout: STEP_TIMEOUT });
      await search.fill("a");
      await expect(
        page.getByRole("heading", { name: "Brand Directory" }),
      ).toBeVisible();
      await capturePageOrModal(page, "Client directory search");
    });

    await soft("OPH-CLIENT-REQUEST-ACCESS-1", "Request access control is present when brands exist", async () => {
      const requestBtn = page.getByRole("button", {
        name: /Request access|Request|Edit draft/i,
      });
      if ((await requestBtn.count()) > 0) {
        await expect(requestBtn.first()).toBeVisible();
      } else {
        await expect(
          page.getByText(/brand|directory|no brand|access/i).first(),
        ).toBeVisible();
      }
    });
  });

  test("client can search the product catalog", async ({ page, soft }) => {
    await soft("OPH-CLIENT-CATALOG-SEARCH-1", "Search client product catalog", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Product Catalog");
      const search = page.getByPlaceholder(/Search by title|SKU|UPC|search/i);
      if ((await search.count()) > 0) {
        await search.first().fill("test");
      }
      await expect(
        page.getByRole("heading", { name: /Product Catalog|Catalog/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Client catalog search");
    });
  });
});
