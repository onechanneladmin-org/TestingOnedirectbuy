import { test } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import { expectPublicHome } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — unauthenticated access", () => {
  test("dashboard hash shows public home for guests", async ({ page, soft }) => {
    await soft(
      "OPH-UNAUTH-GUARD-1",
      "Dashboard hash shows public home for guests",
      async () => {
        await page.goto(`${ONE_PRODUCT_HUB_V2_BASE_URL}#/dashboard`);
        await expectPublicHome(page);
      }
    );
  });

  test("products hash shows public home for guests", async ({ page, soft }) => {
    await soft(
      "OPH-UNAUTH-GUARD-2",
      "Products hash shows public home for guests",
      async () => {
        await page.goto(`${ONE_PRODUCT_HUB_V2_BASE_URL}#/products`);
        await expectPublicHome(page);
      }
    );
  });
});
