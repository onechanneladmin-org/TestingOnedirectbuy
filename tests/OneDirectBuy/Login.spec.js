import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  fillLoginForm,
  loginBuyer,
  hasBuyerCredentials,
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
          .or(page.getByRole("button", { name: /Forgot password\?/i }));
        await expect(forgot.first()).toBeVisible({ timeout: 15_000 });
        const href = await forgot.first().getAttribute("href");
        await forgot.first().click({ force: true });

        const resetUi = page
          .getByRole("heading", { name: /forgot|reset|recover/i })
          .or(page.getByRole("button", { name: /send( reset)?( link| email)?|reset password|email me/i }))
          .or(page.getByText(/enter your email|send a reset|reset link/i));

        let navigated = await page
          .waitForURL(/forgot|reset|recover/i, { timeout: 8_000 })
          .then(() => true)
          .catch(() => false);

        if (
          !navigated &&
          href &&
          href !== "#" &&
          !href.startsWith("javascript")
        ) {
          const path = href.replace(/^https?:\/\/[^/]+/, "");
          await gotoOneDirectBuy(page, path.startsWith("/") ? path : `/${path}`);
          navigated = /forgot|reset|recover/i.test(page.url());
        }

        const hasResetUi = await resetUi
          .first()
          .isVisible({ timeout: 8_000 })
          .catch(() => false);

        if (!navigated && !hasResetUi) {
          throw new Error(
            `Forgot password does not open a reset form (href=${JSON.stringify(href)}). ` +
              "Login stays on /account/login; reset request UI is not implemented.",
          );
        }

        const email =
          ONE_DIRECT_BUY_BUYER_CREDENTIALS.email || "reset-probe@example.com";
        const emailInput = page
          .locator("form")
          .filter({
            has: page.getByRole("button", {
              name: /send|reset|recover|email me/i,
            }),
          })
          .locator("input[type='email'], input[type='text']")
          .first();
        await expect(emailInput).toBeVisible({ timeout: 15_000 });
        await emailInput.click();
        await emailInput.fill("");
        await emailInput.pressSequentially(email, { delay: 20 });

        const submit = page
          .getByRole("button", {
            name: /send|reset|submit|continue|recover|email me/i,
          })
          .filter({ hasNotText: /^Sign in$/i })
          .first();
        await expect(submit).toBeVisible({ timeout: 10_000 });
        await submit.click();

        await expect(
          page
            .getByText(
              /check your email|reset link|sent|if an account|password reset|email has been sent/i,
            )
            .or(page.locator(".ant-notification-notice"))
            .first(),
        ).toBeVisible({ timeout: 20_000 });
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
        page.getByRole("textbox", { name: /^Email address$/i }),
      ).toHaveValue(email);
      await expect(page.getByPlaceholder("Enter your password")).toHaveValue(password);
    });
  });

  test("ODB-UC-006: invalid login is rejected", async ({ page, soft }) => {
    await soft("ODB-UC-006", "Sign-in failed notice for bad credentials", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      await fillLoginForm(page, "nobody-invalid@example.com", "WrongPassword999!");
      await page.getByRole("button", { name: /^Sign in$/i }).click();
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
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }

    await soft("ODB-UC-005-b", "Buyer can log in and reach my-account", async () => {
      await loginBuyer(
        page,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.password,
      );
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(
        page.getByText(/Hello|account dashboard|recent orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });
});
