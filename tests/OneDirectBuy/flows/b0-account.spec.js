// @flow B0 — Account. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 B0. Use cases: ODB-UC-003, 005, 006, 014, 015.
// Replaces the SOFT specs Login, BuyerAccount (part), BuyerAccountAuthenticated, BuyerAccountSecurity (part).
//
// No account is ever created (registration is only checked for its required-field errors) and the
// failed-login case uses a made-up address. The signed-in cases use the fixed test buyer
// (ONEDIRECTBUY_BUYER_EMAIL / _PASSWORD, gitignored .env) and run only with ODB_BUYER_LOGIN=1.
import { test, expect, go } from "./fixtures.js";
import { checkStep } from "../../helpers/checkStep.js";
import { fillLoginForm, clickLogout, hasBuyerCredentials, ONE_DIRECT_BUY_BUYER_CREDENTIALS as BUYER } from "../../helpers/oneDirectBuyAuth.js";

const PROTECTED = ["/account/orders", "/account/addresses", "/account/user-information"];
const signIn = (page) => page.getByRole("button", { name: /^Sign in$/i }).or(page.locator("button.account-auth__submit")).first();
const notice = (page, re) => page.locator(".ant-notification-notice, [role=alert]").filter({ hasText: re }).first();

test.describe("B0 account @flow", () => {
  test("ODB-UC-015 a guest opening an account page is sent to login", async ({ page, health }, testInfo) => {
    for (const path of PROTECTED) {
      await go(page, path);
      await expect(page, `${path} → login`).toHaveURL(/\/account\/login/);
      await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    }
    await checkStep(page, testInfo, { id: "ODB-UC-015", name: "login page", health });
  });

  test("ODB-UC-006 wrong credentials: error shown, no session", async ({ page, health }, testInfo) => {
    await go(page, "/account/login");
    await fillLoginForm(page, "qa-e2e-nobody@example.com", "not-the-password-1");
    await signIn(page).click();
    await expect(notice(page, /invalid|incorrect|wrong|not found|failed/i), "error message").toBeVisible();
    await expect(page).toHaveURL(/\/account\/login/);
    await checkStep(page, testInfo, { id: "ODB-UC-006", name: "login error", health });
    await go(page, "/account/orders");
    await expect(page, "still a guest").toHaveURL(/\/account\/login/);
  });

  test("ODB-UC-003 registration: empty submit shows required-field errors and sends nothing", async ({ page, health }, testInfo) => {
    await go(page, "/account/register");
    const writes = [];
    page.on("request", (r) => r.method() !== "GET" && /onedirectbuy\.com|identitytoolkit/.test(r.url()) && writes.push(r.url()));
    await page.getByRole("button", { name: /^(Register|Sign up|Create account)$/i }).first().click();
    await expect(page.locator(".ant-form-item-explain-error, [aria-invalid=true], .error").first(), "required fields flagged").toBeVisible();
    expect(writes, "no sign-up request with an empty form").toEqual([]);
    await checkStep(page, testInfo, { id: "ODB-UC-003", name: "register validation", health });
  });

  test.describe("signed in (fixed test buyer)", () => {
    test.beforeEach(() => {
      test.skip(process.env.ODB_BUYER_LOGIN !== "1", "set ODB_BUYER_LOGIN=1 to sign in as the fixed test buyer");
      test.skip(!hasBuyerCredentials(), "ONEDIRECTBUY_BUYER_EMAIL / _PASSWORD not set");
    });

    test("ODB-UC-005 / 014 login lands on the account, logout ends the session", async ({ page, health }, testInfo) => {
      await go(page, "/account/login");
      await fillLoginForm(page, BUYER.email, BUYER.password);
      await signIn(page).click();
      await expect(notice(page, /Login successful/i)).toBeVisible();
      await go(page, "/account/orders");
      await expect(page, "orders page opens when signed in").toHaveURL(/\/account\/orders/);
      await checkStep(page, testInfo, { id: "ODB-UC-005", name: "signed in", health });
      await clickLogout(page);
      await go(page, "/account/orders");
      await expect(page, "logged out → login again").toHaveURL(/\/account\/login/);
    });
  });
});
