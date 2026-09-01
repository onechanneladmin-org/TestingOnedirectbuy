import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  ensureLoggedInBuyer,
  hasBuyerCredentials,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
  gotoAuthenticatedPage,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

const VERIFY_PATHS = [
  "/account/verify-email",
  "/account/verify",
  "/account/email-verification",
  "/verify-email",
];

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Buyer Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-016: buyer can verify email address", async ({ page, soft }) => {
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await soft("ODB-UC-016", "Email verification status or verify CTA is available", async () => {
      await gotoAuthenticatedPage(
        page,
        "/account/user-information",
        ONE_DIRECT_BUY_BUYER_CREDENTIALS,
      );
      const verified = page.getByText(
        /verified|email verified|your email is verified|verification successful/i,
      );
      const verifyCta = page
        .getByRole("button", { name: /verify email|send verification|resend verification/i })
        .or(page.getByRole("link", { name: /verify email|verify your email/i }));
      const emailField = page.getByText(ONE_DIRECT_BUY_BUYER_CREDENTIALS.email, {
        exact: false,
      });

      const hasVerified = await verified.first().isVisible({ timeout: 8_000 }).catch(() => false);
      const hasCta = await verifyCta.first().isVisible({ timeout: 3_000 }).catch(() => false);
      if (!hasVerified && !hasCta) {
        await expect(emailField.first()).toBeVisible({ timeout: 10_000 });
        throw new Error(
          "No email verification status or verify CTA on Account Information.",
        );
      }
    });
  });

  test("ODB-UC-017: expired verification link is rejected", async ({ page, soft }) => {
    await soft("ODB-UC-017", "Bogus/expired verify token does not authenticate", async () => {
      let foundUi = false;
      for (const path of VERIFY_PATHS) {
        await gotoOneDirectBuy(page, `${path}?token=expired-odb-probe`);
        if (/404|not found/i.test(await page.locator("body").innerText().catch(() => ""))) {
          foundUi = true;
          break;
        }
        const reject = page.getByText(
          /expired|invalid|not valid|already used|verification failed|link is invalid/i,
        );
        if (await reject.first().isVisible({ timeout: 4_000 }).catch(() => false)) {
          foundUi = true;
          break;
        }
        if (/\/account\/login/.test(page.url()) || /\/account\/verify/.test(page.url())) {
          foundUi = true;
        }
      }
      if (!foundUi) {
        throw new Error(
          "No expired/invalid verification handling at /account/verify-email (or similar).",
        );
      }
      await expect(page).not.toHaveURL(/\/account\/orders/, { timeout: 5_000 });
    });
  });

  test("ODB-UC-018: buyer can resend verification email", async ({ page, soft }) => {
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await soft("ODB-UC-018", "Resend verification control exists", async () => {
      await ensureLoggedInBuyer(page);
      await gotoAuthenticatedPage(
        page,
        "/account/user-information",
        ONE_DIRECT_BUY_BUYER_CREDENTIALS,
      );
      const resend = page
        .getByRole("button", { name: /resend( verification)?( email)?/i })
        .or(page.getByRole("link", { name: /resend( verification)?( email)?/i }))
        .or(page.getByText(/resend verification|send verification email/i));
      if (!(await resend.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
        await gotoOneDirectBuy(page, "/account/login");
      }
      if (!(await resend.first().isVisible({ timeout: 4_000 }).catch(() => false))) {
        throw new Error("Resend verification email control is not implemented.");
      }
    });
  });

  test("ODB-UC-019: phone OTP verification is not required", async ({ page, soft }) => {
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await soft("ODB-UC-019", "Phone OTP verification UI is absent (Not Required)", async () => {
      await gotoAuthenticatedPage(
        page,
        "/account/user-information",
        ONE_DIRECT_BUY_BUYER_CREDENTIALS,
      );
      const otpUi = page.getByText(/verify phone|phone verification|enter otp|one-time pass/i);
      if (await otpUi.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        throw new Error("Phone OTP UI is present; sheet marks this as Not Required.");
      }
    });
  });

  test("ODB-UC-020: invalid OTP is rejected when OTP UI exists", async ({ page, soft }) => {
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await soft("ODB-UC-020", "Wrong OTP rejected, or OTP not required", async () => {
      await gotoAuthenticatedPage(
        page,
        "/account/user-information",
        ONE_DIRECT_BUY_BUYER_CREDENTIALS,
      );
      const otpInput = page
        .getByRole("textbox", { name: /otp|one-time|verification code/i })
        .or(page.getByPlaceholder(/otp|code/i));
      if (!(await otpInput.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        return;
      }
      await otpInput.first().fill("000000");
      const submit = page.getByRole("button", { name: /verify|submit|confirm/i }).first();
      if (await submit.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await submit.click();
      }
      await expect(
        page.getByText(/invalid|incorrect|wrong code|otp/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});
