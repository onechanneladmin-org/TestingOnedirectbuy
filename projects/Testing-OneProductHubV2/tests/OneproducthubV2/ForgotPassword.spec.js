import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { openLoginForRole } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — forgot password", () => {
  test("forgot password UI opens from brand login", async ({ page, soft }) => {
    await soft(
      "OPH-FORGOT-PASSWORD-1",
      "Forgot password UI opens from brand login",
      async () => {
        await openLoginForRole(page, "Brand");
        await page.getByRole("button", { name: "Forgot password?" }).click();

        await expect(
          page.getByText(/reset|forgot|email|password/i).first()
        ).toBeVisible({ timeout: STEP_TIMEOUT });
      }
    );
  });
});
