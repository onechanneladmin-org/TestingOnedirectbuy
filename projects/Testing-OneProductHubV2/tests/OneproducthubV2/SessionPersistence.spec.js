import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — session persistence", () => {
  test("brand session survives a full page reload", async ({ page, soft }) => {
    await soft(
      "OPH-SESSION-PERSIST-1",
      "Brand session survives full page reload",
      async () => {
        await signInAsBrand(page);
        await page.reload({ waitUntil: "domcontentloaded" });

        await expect(
          page.getByRole("heading", { name: "Workspace Overview" })
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
      }
    );
  });
});
