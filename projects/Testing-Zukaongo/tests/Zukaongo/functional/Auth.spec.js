import { test, expect } from "../../fixtures/zukaTest.js";
import {
  openLogin,
  submitLogin,
  signIn,
  signOutStaff,
  signOutCustomer,
  signedInMarker,
} from "../../helpers/zukaAuth.js";
import {
  ACCOUNTS,
  CUSTOMER_URL,
  ADMIN_URL,
  PARTNER_URL,
  PARTNER_ALIAS_URL,
  STEP_TIMEOUT,
} from "../../helpers/zukaEnv.js";

/**
 * Sign-in for every role in doc §1 on the portal it uses, wrong-password errors,
 * sign-out, and the partner web app alias (PA-11).
 */
test.describe("ZUKAongo — authentication", () => {
  test("customer signs in on zukaongo.com and reaches the app", async ({ page, soft }) => {
    await soft("ZUKA-AUTH-01", "Customer signs in and sees Home / Orders / Cart / Profile tabs", async () => {
      await signIn(page, "customer");
      for (const tab of ["Home", "Orders", "Profile"]) {
        await expect(page.getByRole("tab", { name: new RegExp(`^${tab}$`) })).toBeVisible();
      }
      await expect(page.getByRole("tab", { name: /^Cart/ })).toBeVisible();
    });
    await soft("ZUKA-AUTH-02", "Profile shows the signed-in customer's email", async () => {
      await page.getByRole("tab", { name: /^Profile$/ }).click();
      await expect(page.getByText(ACCOUNTS.customer.email).first()).toBeVisible({ timeout: STEP_TIMEOUT });
    });
    await soft("ZUKA-AUTH-03", "Customer logs out from Profile and returns to sign-in", async () => {
      await signOutCustomer(page);
      await page.goto(`${CUSTOMER_URL}/profile`, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: "Sign in", level: 1 }).or(page.getByRole("button", { name: "Sign in", exact: true })).first(),
      ).toBeVisible({ timeout: 45_000 });
    });
  });

  test("second customer account signs in", async ({ page, soft }) => {
    await soft("ZUKA-AUTH-04", "Customer 2 signs in on zukaongo.com", async () => {
      await signIn(page, "customer2");
      await page.getByRole("tab", { name: /^Profile$/ }).click();
      await expect(page.getByText(ACCOUNTS.customer2.email).first()).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });

  test("customer wrong password shows an inline error and stays on sign-in", async ({ page, soft }) => {
    await soft("ZUKA-AUTH-05", "Wrong password → 'Email or password is incorrect.'", async () => {
      await openLogin(page, "customer");
      await submitLogin(page, ACCOUNTS.customer.email, "definitely-wrong-pass-1");
      await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect." })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test("customer sign-in page offers guest, Google, sign-up and password reset", async ({ page, soft }) => {
    await soft("ZUKA-AUTH-06", "Sign-in page shows Google, guest and create-account options", async () => {
      await openLogin(page, "customer");
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue as guest" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Create an account" })).toBeVisible();
    });
    await soft("ZUKA-AUTH-07", "Forgot password opens the reset-link form", async () => {
      await page.getByRole("button", { name: "Forgot password?" }).click();
      await expect(page).toHaveURL(/\/forgot/);
      await expect(page.getByRole("heading", { name: "Forgot password", level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
    });
    await soft("ZUKA-AUTH-08", "Create account form asks for name, email and a 6+ character password", async () => {
      await openLogin(page, "customer");
      await page.getByRole("button", { name: "Create an account" }).click();
      await expect(page).toHaveURL(/\/signup/);
      await expect(page.getByRole("heading", { name: "Create account", level: 1 })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Name" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Password" })).toHaveAttribute("placeholder", /6 characters/);
    });
    await soft("ZUKA-AUTH-09", "Continue as guest opens the app without an account", async () => {
      await openLogin(page, "customer");
      await page.getByRole("button", { name: "Continue as guest" }).click();
      await expect(page.getByRole("tab", { name: /^Home$/ })).toBeVisible({ timeout: 45_000 });
    });
  });

  test("superadmin signs in on admin.zukaongo.com and signs out", async ({ page, soft }) => {
    await soft("ZUKA-AUTH-10", "Superadmin signs in and sees the full admin console", async () => {
      await signIn(page, "admin");
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      await expect(nav.getByText(ACCOUNTS.admin.email)).toBeVisible();
      await expect(nav.getByText("superadmin", { exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
    });
    await soft("ZUKA-AUTH-11", "Superadmin signs out back to 'Sign in to Zuka'", async () => {
      await signOutStaff(page);
      await expect(page.getByRole("heading", { name: "Sign in to Zuka" })).toBeVisible();
    });
  });

  for (const key of ["kitchen", "grocery", "kitchenMulti"]) {
    const account = ACCOUNTS[key];
    test(`${account.label} signs in to admin as reception`, async ({ page, soft }) => {
      await soft(`ZUKA-AUTH-12-${key}`, `${account.label} signs in with the reception role`, async () => {
        await signIn(page, key);
        const nav = page.getByRole("navigation", { name: "Main navigation" });
        await expect(nav.getByText(account.email)).toBeVisible();
        await expect(nav.getByText("reception", { exact: true })).toBeVisible();
      });
    });
  }

  test("admin wrong password is rejected", async ({ page, soft }) => {
    await soft("ZUKA-AUTH-13", "Admin wrong password shows an error and no console", async () => {
      await openLogin(page, "admin");
      await submitLogin(page, ACCOUNTS.kitchen.email, "definitely-wrong-pass-1");
      await expect(page.getByText(/Email or password is incorrect|invalid|incorrect/i).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(signedInMarker(page, "admin")).toBeHidden();
    });
  });

  for (const key of ["driver", "driver2"]) {
    const account = ACCOUNTS[key];
    test(`${account.label} signs in to the partner app and signs out`, async ({ page, soft }) => {
      await soft(`ZUKA-AUTH-14-${key}`, `${account.label} signs in and lands on Deliveries`, async () => {
        await signIn(page, key);
        await expect(page.getByText(account.email).first()).toBeVisible();
        await expect(page.getByRole("button", { name: /Go online|Go offline/ })).toBeVisible();
      });
      await soft(`ZUKA-AUTH-15-${key}`, `${account.label} signs out to the partner sign-in`, async () => {
        await signOutStaff(page);
        await expect(page.getByRole("heading", { name: "ZukaOngo Partner" })).toBeVisible();
      });
    });
  }

  test("partner app wrong password is rejected", async ({ page, soft }) => {
    await soft("ZUKA-AUTH-16", "Partner app wrong password → 'Email or password is incorrect.'", async () => {
      await openLogin(page, "partner");
      await submitLogin(page, ACCOUNTS.driver.email, "definitely-wrong-pass-1");
      await expect(page.getByText("Email or password is incorrect.").first()).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });

  test("PA-11: partners.zukaongo.com and drivers.zukaongo.com both open the partner app", async ({ page, soft }) => {
    for (const [i, url] of [PARTNER_URL, PARTNER_ALIAS_URL].entries()) {
      await soft(`ZUKA-AUTH-17-${i + 1}`, `${new URL(url).host} shows the ZukaOngo Partner sign-in`, async () => {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "ZukaOngo Partner" })).toBeVisible({ timeout: 45_000 });
        await expect(page).toHaveTitle(/ZukaOngo Partner/);
      });
    }
    await soft("ZUKA-AUTH-18", "Driver signs in on the partners.zukaongo.com alias", async () => {
      await submitLogin(page, ACCOUNTS.driver.email, ACCOUNTS.driver.password);
      await expect(page.getByRole("heading", { name: "Deliveries", level: 1 })).toBeVisible({ timeout: 45_000 });
    });
  });

  test("signed-out visitors cannot open staff screens", async ({ page, soft }) => {
    await soft("ZUKA-AUTH-19", "admin.zukaongo.com/orders without a session shows sign-in", async () => {
      await page.goto(`${ADMIN_URL}/orders`, { waitUntil: "domcontentloaded" });
      await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 45_000 });
      await expect(signedInMarker(page, "admin")).toBeHidden();
    });
    await soft("ZUKA-AUTH-20", "drivers.zukaongo.com/settings without a session shows sign-in", async () => {
      await page.goto(`${PARTNER_URL}/settings`, { waitUntil: "domcontentloaded" });
      await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 45_000 });
    });
  });
});
