import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand dashboard", () => {
  test("brand dashboard shows workspace metrics and recent products", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-DASHBOARD", "Brand dashboard workspace overview", async () => {
      await signInAsBrand(page);

      await expect(
        page.getByRole("heading", { name: "Workspace Overview" })
      ).toBeVisible();
      await expect(page.getByText(/TOTAL PRODUCTS|In Stock|products/i).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(page.getByRole("button", { name: "Add Product" })).toBeVisible();
    });
  });
});
