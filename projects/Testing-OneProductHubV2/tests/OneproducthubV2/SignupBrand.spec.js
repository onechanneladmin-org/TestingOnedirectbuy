import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand signup UI", () => {
  test("brand signup form is reachable and shows required fields", async ({
    page,
    soft,
  }) => {
    await soft(
      "OPH-SIGNUP-BRAND-1",
      "Brand signup form reachable with required fields",
      async () => {
        await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
        await page.getByRole("button", { name: "Login" }).click();
        await page.getByRole("button", { name: "Continue as Brand" }).click();
        await page.getByRole("button", { name: "Create account" }).click();

        await expect(
          page.getByText(/sign up|create|register|brand/i).first()
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        await expect(
          page.getByRole("textbox", { name: /email/i }).first()
        ).toBeVisible({ timeout: STEP_TIMEOUT });
      }
    );
  });
});
