import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  fillInputField,
  fillLoginForm,
  ensureLoggedInBuyer,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
  expectGuestRedirectToLogin,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

const PROTECTED_ACCOUNT_PATHS = [
  "/account/orders",
  "/account/addresses",
  "/account/user-information",
];

test.describe("OneDirectBuy — Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-015: logged-out user cannot open protected account pages", async ({
    page,
    soft,
  }) => {
    for (const path of PROTECTED_ACCOUNT_PATHS) {
      const ok = await soft(
        `ODB-UC-015-${path.replace(/^\//, "").replace(/\//g, "-")}`,
        `Guest ${path} redirects to login`,
        async () => {
          await expectGuestRedirectToLogin(page, path);
        },
      );
      if (!ok) break;
    }
  });

  test("ODB-UC-008: buyer can request a password reset", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-008-link", "Forgot password? link present", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      await expect(
        page.getByRole("link", { name: /Forgot password\?/i }),
      ).toBeVisible();
    });

    await soft(
      "ODB-UC-008",
      "Submit reset with buyer email shows confirmation",
      async () => {
        await gotoOneDirectBuy(page, "/account/login");
        const forgot = page
          .getByRole("link", { name: /Forgot password\?/i })
          .or(page.getByRole("button", { name: /Forgot password\?/i }))
          .first();
        await expect(forgot).toBeVisible({ timeout: 15_000 });

        const email =
          ONE_DIRECT_BUY_BUYER_CREDENTIALS.email || "reset-probe@example.com";

        const emailInput = page
          .locator("#username")
          .or(page.getByRole("textbox", { name: /^Email address$/i }))
          .or(page.getByPlaceholder("you@example.com"))
          .first();
        await fillInputField(emailInput, email);

        await forgot.click();

        const sending = page.getByRole("link", { name: /Sending reset/i });
        const confirmationNotice = page
          .locator(".ant-notification-notice, .ant-message-notice")
          .filter({
            hasText:
              /Reset email sent|password reset|link has been sent|check your email|if an account exists/i,
          })
          .or(
            page.getByText(
              /Reset email sent|password reset|link has been sent|check your email/i,
            ),
          )
          .first();

        const sendingShown = await sending
          .isVisible({ timeout: 15_000 })
          .catch(() => false);
        const confirmed = await confirmationNotice
          .isVisible({ timeout: sendingShown ? 5_000 : 8_000 })
          .catch(() => false);

        if (!sendingShown && !confirmed) {
          const dedicatedSubmit = page
            .getByRole("button", {
              name: /send|reset|submit|continue|recover|email me/i,
            })
            .filter({ hasNotText: /^Sign in$/i })
            .first();
          if (await dedicatedSubmit.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await dedicatedSubmit.click();
          }
        }

        if (!sendingShown && !confirmed) {
          throw new Error(
            "Forgot password did not start sending a reset (no Sending reset… or confirmation).",
          );
        }
        await expect(
          page.getByRole("link", { name: /Forgot password\?|Sending reset/i }),
        ).toBeVisible({ timeout: 15_000 });
      },
    );
  });

  test("ODB-UC-005: login form accepts email and password input", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-005-a", "Email/password fields accept typed values", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      const email = "probe@example.com";
      const password = "ProbePass123!";
      await fillLoginForm(page, email, password);
      await expect(
        page
          .locator("#username")
          .or(page.getByRole("textbox", { name: /^Email address$/i }))
          .or(page.getByPlaceholder("you@example.com"))
          .first(),
      ).toHaveValue(email);
      await expect(
        page
          .locator("#login-password")
          .or(page.getByPlaceholder("Enter your password"))
          .or(page.getByRole("textbox", { name: /^Password$/i }))
          .first(),
      ).toHaveValue(password);
    });
  });

  test("ODB-UC-006: invalid login is rejected", async ({ page, soft }) => {
    await soft("ODB-UC-006", "Sign-in failed notice for bad credentials", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      await fillLoginForm(page, "nobody-invalid@example.com", "WrongPassword999!");
      const signinBtn = page
        .getByRole("button", { name: /^Sign in$/i })
        .or(page.locator("button.account-auth__submit"))
        .first();
      await signinBtn.click();
      await expect(
        page.locator(".ant-notification-notice").filter({
          hasText: /Sign-in failed|email or password is incorrect/i,
        }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/account\/login/);
    });
  });

  test("ODB-UC-005: buyer logs in with configured credentials", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-005-b", "Buyer can log in and reach my-account", async () => {
      await ensureLoggedInBuyer(page);
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(
        page.getByText(/Hello|account dashboard|recent orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });
});
