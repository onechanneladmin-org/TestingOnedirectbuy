import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { openLoginForRole } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client signup UI", () => {
  test("client signup form is reachable and shows required fields", async ({
    page,
    soft,
  }) => {
    await soft(
      "OPH-SIGNUP-CLIENT-1",
      "Client signup form reachable with required fields",
      async () => {
        await openLoginForRole(page, "Client");
        await page.getByRole("button", { name: "Create account" }).click();

        await expect(
          page.getByText(/sign up|create|register|client/i).first()
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        await expect(
          page.getByRole("textbox", { name: /email/i }).first()
        ).toBeVisible({ timeout: STEP_TIMEOUT });
      }
    );
  });
});
