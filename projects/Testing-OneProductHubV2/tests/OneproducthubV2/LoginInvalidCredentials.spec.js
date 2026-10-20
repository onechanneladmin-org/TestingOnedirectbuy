import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  ONE_PRODUCT_HUB_V2_BRAND_CREDENTIALS,
  openLoginForRole,
  submitSignInForm,
} from "../helpers/oneProductHubV2Auth.js";

test.describe("One Product Hub V2 — invalid credentials", () => {
  test("wrong password shows an error and stays on login", async ({
    page,
    soft,
  }) => {
    await soft(
      "OPH-LOGIN-INVALID-1",
      "Wrong password shows error and stays on login",
      async () => {
        await openLoginForRole(page, "Brand");
        await submitSignInForm(page, {
          email: ONE_PRODUCT_HUB_V2_BRAND_CREDENTIALS.email,
          password: "WrongPassword!999",
        });

        await expect(
          page.getByText(/invalid|incorrect|wrong|failed|error|password/i).first()
        ).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
      }
    );
  });
});
