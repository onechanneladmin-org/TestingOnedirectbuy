import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  ONE_PRODUCT_HUB_V2_BRAND_CREDENTIALS,
  ONE_PRODUCT_HUB_V2_CLIENT_CREDENTIALS,
  openLoginForRole,
  submitSignInForm,
} from "../helpers/oneProductHubV2Auth.js";

test.describe("One Product Hub V2 — wrong portal sign-in", () => {
  test("brand credentials on client login path show an error", async ({
    page,
    soft,
  }) => {
    await soft(
      "OPH-LOGIN-WRONG-PORTAL-1",
      "Brand credentials rejected on client login",
      async () => {
        await openLoginForRole(page, "Client");
        await submitSignInForm(page, ONE_PRODUCT_HUB_V2_BRAND_CREDENTIALS);

        await expect(
          page.getByText(/This account is a Brand user|brand/i).first()
        ).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
      }
    );
  });

  test("client credentials on brand login path show an error", async ({
    page,
    soft,
  }) => {
    await soft(
      "OPH-LOGIN-WRONG-PORTAL-2",
      "Client credentials rejected on brand login",
      async () => {
        await openLoginForRole(page, "Brand");
        await submitSignInForm(page, ONE_PRODUCT_HUB_V2_CLIENT_CREDENTIALS);

        await expect(
          page.getByText(/This account is a Client user|client/i).first()
        ).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
      }
    );
  });
});
