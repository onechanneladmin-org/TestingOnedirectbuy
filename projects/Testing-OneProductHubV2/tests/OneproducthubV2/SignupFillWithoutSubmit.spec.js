import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { openLoginForRole } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — signup fill without submit", () => {
  test("brand registration form can be filled without creating an account", async ({
    page,
    soft,
  }) => {
    await soft("OPH-SIGNUP-BRAND-FILL-1", "Fill brand registration without submit", async () => {
      await openLoginForRole(page, "Brand");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page.getByRole("heading", { name: /Create Brand Account/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await page.getByRole("textbox", { name: /Full Name/i }).fill("OPH Test Brand");
      await page.getByRole("textbox", { name: /Email Address/i }).fill("oph-brand-ui@example.com");
      await page.getByRole("textbox", { name: /Brand\/Company Name/i }).fill("OPH UI Brand");
      await expect(page.getByRole("button", { name: /^Create Account$/i })).toBeDisabled();
      await capturePageOrModal(page, "Brand signup filled");
    });
  });

  test("client B2B registration form can be filled without creating an account", async ({
    page,
    soft,
  }) => {
    await soft("OPH-SIGNUP-CLIENT-FILL-1", "Fill client B2B registration without submit", async () => {
      await openLoginForRole(page, "Client");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page.getByRole("heading", { name: /Create Client Account/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await page.getByRole("textbox", { name: /Full Name/i }).fill("OPH Test Client");
      await page.getByRole("textbox", { name: /Email Address/i }).fill("oph-client-ui@example.com");
      await expect(
        page.getByRole("button", { name: /Submit B2B Registration for Verification/i }),
      ).toBeDisabled();
      await capturePageOrModal(page, "Client signup filled");
    });
  });
});
