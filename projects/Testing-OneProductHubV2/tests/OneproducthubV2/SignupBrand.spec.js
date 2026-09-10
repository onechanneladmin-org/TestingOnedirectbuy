import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { openLoginForRole } from "../helpers/oneProductHubV2Auth.js";
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
        await openLoginForRole(page, "Brand");
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
