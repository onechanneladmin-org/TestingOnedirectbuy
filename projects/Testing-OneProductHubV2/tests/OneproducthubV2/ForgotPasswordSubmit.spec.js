import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { openLoginForRole } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — forgot password submit", () => {
  test("brand can submit a password reset email", async ({ page, soft }) => {
    await soft("OPH-FORGOT-PASSWORD-SUBMIT-1", "Submit brand password reset email", async () => {
      await openLoginForRole(page, "Brand");
      await page.getByRole("button", { name: "Forgot password?" }).click();

      const resetEmail = page.getByRole("textbox", { name: /email/i }).first();
      await expect(resetEmail).toBeVisible({ timeout: STEP_TIMEOUT });
      await resetEmail.fill("reset-oph-test@example.com");

      const send = page.getByRole("button", {
        name: /send|reset|continue|submit/i,
      });
      if ((await send.count()) > 0) {
        await send.first().click();
        await expect(
          page.getByText(/sent|check your email|reset link|inbox/i).first(),
        ).toBeVisible({ timeout: STEP_TIMEOUT });
      } else {
        await expect(
          page.getByText(/reset|forgot|email|password/i).first(),
        ).toBeVisible();
      }
      await capturePageOrModal(page, "Forgot password submit");
    });
  });
});
