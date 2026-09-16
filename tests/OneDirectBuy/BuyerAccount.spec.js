import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy, dismissCookieBanner } from "../helpers/oneDirectBuyNav.js";
import {
  fillRegisterForm,
  uniqueTestEmail,
  expectGuestRedirectToLogin,
  wipeBuyerSession,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Buyer Account (public)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-385: terms acceptance is shown during signup", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-385", "Conditions of Use + Privacy Notice on register", async () => {
      await gotoOneDirectBuy(page, "/account/register");
      await expect(
        page.getByRole("heading", { name: /^Create your account$/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/Passwords must be at least 6 characters/i),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Conditions of Use/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Privacy Notice/i }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /^Sign in$/i })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Continue with Google$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-003: register form fields are present", async ({ page, soft }) => {
    await soft("ODB-UC-003-fields", "Full name / email / passwords / Create CTA", async () => {
      await gotoOneDirectBuy(page, "/account/register");
      await dismissCookieBanner(page);
      await expect(page.getByRole("textbox", { name: /^Full name$/i })).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^Email address$/i }),
      ).toBeVisible();
      await expect(page.getByPlaceholder("Create a password")).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^Confirm password$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Create your account/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-003: validate required signup fields", async ({ page, soft }) => {
    await soft("ODB-UC-003", "Empty submit stays on register with validation", async () => {
      await gotoOneDirectBuy(page, "/account/register");
      await dismissCookieBanner(page);
      await page.getByRole("button", { name: /Create your account/i }).click();
      await expect(page).toHaveURL(/\/account\/register/);
      const invalid = page.locator("input:invalid");
      const antError = page.locator(
        ".ant-form-item-explain-error, .ant-form-item-has-error, [role='alert']",
      );
      await expect(invalid.or(antError).first()).toBeVisible({ timeout: 8_000 });
    });
  });

  test("ODB-UC-001: register new buyer account", async ({ page, soft }) => {
    await soft("ODB-UC-001", "Create account with unique email reaches account", async () => {
      const email = uniqueTestEmail();
      await gotoOneDirectBuy(page, "/account/register");
      await fillRegisterForm(page, {
        name: "Test Buyer",
        email,
        password: "TestPass123!",
      });
      await page.getByRole("button", { name: /Create your account/i }).click();
      await expect(
        page.locator(".ant-notification-notice").filter({
          hasText: /Registration successful/i,
        }),
      ).toBeVisible({ timeout: 45_000 });
    });
  });

  test("ODB-UC-002: prevent duplicate registration with existing email", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-002", "Existing email shows already/exists notice", async () => {
      const email = uniqueTestEmail();
      const password = "TestPass123!";
      await gotoOneDirectBuy(page, "/account/register");
      await fillRegisterForm(page, {
        name: "Duplicate Test",
        email,
        password,
      });
      await page.getByRole("button", { name: /Create your account/i }).click();
      await expect(
        page.locator(".ant-notification-notice").filter({
          hasText: /Registration successful/i,
        }),
      ).toBeVisible({ timeout: 45_000 });

      await wipeBuyerSession(page);
      await gotoOneDirectBuy(page, "/account/register");
      await expect(
        page
          .getByRole("heading", { name: /Create your account/i })
          .or(page.getByRole("textbox", { name: /^Full name$/i }))
          .or(page.getByRole("button", { name: /Create your account/i }))
          .first(),
      ).toBeVisible({ timeout: 30_000 });

      await fillRegisterForm(page, {
        name: "Duplicate Test",
        email,
        password,
      });
      await page.getByRole("button", { name: /Create your account/i }).click();
      await expect(
        page
          .locator(".ant-notification-notice")
          .filter({ hasText: /already|exists|in use|failed|email/i })
          .first(),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page).toHaveURL(/\/account\/register/);
    });
  });

  test("ODB-UC-015: guest visiting orders redirects to login", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-015-orders", "/account/orders as guest → login, no order table", async () => {
      await expectGuestRedirectToLogin(page, "/account/orders");
      await expect(page.locator("table")).toHaveCount(0);
    });
  });
});
