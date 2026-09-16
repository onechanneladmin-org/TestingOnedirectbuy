import { expect } from "@playwright/test";
import {
  gotoOneDirectBuy,
  dismissCookieBanner,
  dismissAssistantOverlay,
} from "./oneDirectBuyNav.js";

export const ONE_DIRECT_BUY_BUYER_CREDENTIALS = {
  email: process.env.ONEDIRECTBUY_BUYER_EMAIL || "",
  password: process.env.ONEDIRECTBUY_BUYER_PASSWORD || "",
};

export const ONE_DIRECT_BUY_ADMIN_CREDENTIALS = {
  email:
    process.env.ONEDIRECTBUY_ADMIN_EMAIL ||
    process.env.ONEDIRECTBUY_BUYER_EMAIL ||
    "",
  password:
    process.env.ONEDIRECTBUY_ADMIN_PASSWORD ||
    process.env.ONEDIRECTBUY_BUYER_PASSWORD ||
    "",
};

export function hasBuyerCredentials() {
  return Boolean(
    ONE_DIRECT_BUY_BUYER_CREDENTIALS.email &&
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.password
  );
}

export function hasAdminCredentials() {
  return Boolean(
    ONE_DIRECT_BUY_ADMIN_CREDENTIALS.email &&
      ONE_DIRECT_BUY_ADMIN_CREDENTIALS.password
  );
}

export function uniqueTestEmail() {
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  return `odb.playwright.${stamp}@example.com`;
}

const DEFAULT_PASSWORD = "TestPass123!";

/** Reliably type into Ant Design / React controlled inputs. */
export async function fillInputField(locator, value) {
  await expect(async () => {
    await expect(locator).toBeVisible({ timeout: 10_000 });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ timeout: 5_000 });
    await locator.fill("");
    await locator.pressSequentially(value, { delay: 20 });
    await expect(locator).toHaveValue(value, { timeout: 5_000 });
  }).toPass({ intervals: [500, 1000, 1500], timeout: 25_000 });
}

/** Fill the OneDirectBuy login form (email + password). */
export async function fillLoginForm(page, email, password) {
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
  await expect(
    page.getByRole("heading", { name: /Welcome back/i }),
  ).toBeVisible({ timeout: 30_000 });

  const emailInput = page
    .locator("#username")
    .or(page.getByRole("textbox", { name: /^Email address$/i }))
    .or(page.getByPlaceholder("you@example.com"))
    .first();

  const passwordInput = page
    .locator("#login-password")
    .or(page.getByPlaceholder("Enter your password"))
    .or(page.getByRole("textbox", { name: /^Password$/i }))
    .or(page.locator("input[type='password']"))
    .first();

  await fillInputField(emailInput, email);
  await fillInputField(passwordInput, password);
}

/** Fill the OneDirectBuy registration form. */
export async function fillRegisterForm(page, { name, email, password }) {
  await dismissCookieBanner(page);
  await expect(
    page.getByRole("heading", { name: /Create your account/i }),
  ).toBeVisible({ timeout: 30_000 });

  await fillInputField(
    page
      .getByRole("textbox", { name: /^Full name$/i })
      .or(page.getByPlaceholder("Your name"))
      .first(),
    name,
  );
  await fillInputField(
    page
      .getByRole("textbox", { name: /^Email address$/i })
      .or(page.getByPlaceholder("you@example.com"))
      .first(),
    email,
  );
  await fillInputField(
    page
      .getByPlaceholder("Create a password")
      .or(page.locator("input[type='password']").first())
      .first(),
    password,
  );
  await fillInputField(
    page
      .getByRole("textbox", { name: /^Confirm password$/i })
      .or(page.getByPlaceholder("Re-enter password"))
      .or(page.locator("input[type='password']").nth(1))
      .first(),
    password,
  );
}

/** Account dashboard region (avoids AI chat / header false matches). */
export function accountDashboard(page) {
  return page
    .locator(
      ".ps-section--account, .ps-page--account, .ps-widget--account-dashboard, main .ps-section",
    )
    .first();
}

/** Assert the session is authenticated via a gated account route (my-account is public). */
export async function expectLoggedIn(page) {
  const successNotice = page.locator(".ant-notification-notice").filter({
    hasText: /Login successful|Registration successful/i,
  });
  if (await successNotice.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await page
      .waitForURL((url) => !url.pathname.includes("/account/login"), {
        timeout: 12_000,
      })
      .catch(() => {});
    await page.waitForTimeout(1000);
  }

  await gotoOneDirectBuy(page, "/account/orders");
  await expect(page).not.toHaveURL(/\/account\/login/, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/account\/orders/, { timeout: 15_000 });
}

const ACCOUNT_SIDEBAR_LINKS = {
  "/account/orders": /Orders/i,
  "/account/addresses": /Address/i,
  "/account/user-information": /Account Information|Account Details/i,
  "/account/wishlist": /Wishlist/i,
  "/account/security": /Account security/i,
};

/** Navigate to a protected page and re-login if Firebase auth has not hydrated yet. */
export async function gotoAuthenticatedPage(page, path, credentials) {
  await ensureLoggedInBuyer(page);

  const normalizedPath = path.replace(/\/$/, "") || path;
  const sidebarPattern = ACCOUNT_SIDEBAR_LINKS[normalizedPath];

  async function recoverIfLoggedOut() {
    if (!page.url().includes("/account/login")) return;
    await loginBuyer(page, credentials.email, credentials.password);
    await gotoOneDirectBuy(page, path);
  }

  if (sidebarPattern) {
    await gotoOneDirectBuy(page, "/account/my-account");
    await recoverIfLoggedOut();
    const sidebarLink = page
      .locator(".ps-widget--account-dashboard a, aside.ps-widget--account-dashboard a")
      .filter({ hasText: sidebarPattern })
      .first();
    if (await sidebarLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await sidebarLink.click();
      await recoverIfLoggedOut();
      const landed = await page
        .waitForURL(new RegExp(normalizedPath.replace(/\//g, "\\/")), {
          timeout: 8_000,
        })
        .then(() => true)
        .catch(() => false);
      if (landed && !page.url().includes("/account/login")) {
        return;
      }
    }
  }

  await gotoOneDirectBuy(page, path);
  await recoverIfLoggedOut();
  await expect(page).not.toHaveURL(/\/account\/login$/, { timeout: 15_000 });
}

/** Open Account security (new hub) without requiring a specific URL. */
export async function openAccountSecurityPage(page) {
  await ensureLoggedInBuyer(page);
  await gotoAuthenticatedPage(
    page,
    "/account/user-information",
    ONE_DIRECT_BUY_BUYER_CREDENTIALS,
  );
  const securityLink = page
    .getByRole("link", { name: /^Account security$/i })
    .or(page.getByRole("button", { name: /^Account security$/i }));
  if (await securityLink.first().isVisible({ timeout: 8_000 }).catch(() => false)) {
    await securityLink.first().click();
  } else {
    await gotoOneDirectBuy(page, "/account/security");
    if (page.url().includes("/account/login")) {
      await loginBuyer(
        page,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.password,
      );
      await gotoOneDirectBuy(page, "/account/security");
    }
  }
  await expect(page).not.toHaveURL(/\/account\/login/, { timeout: 15_000 });
  await expect(
    page
      .getByPlaceholder(/current password|new password/i)
      .or(page.getByRole("heading", { name: /^Account security$/i }))
      .or(page.getByRole("textbox", { name: /current password|new password/i }))
      .first(),
  ).toBeVisible({ timeout: 20_000 });
}

/** Click the account sidebar logout control (not the hidden header dropdown link). */
export async function clickLogout(page) {
  await gotoOneDirectBuy(page, "/account/my-account");
  const sidebarLogout = page
    .locator(".ps-widget--account-dashboard .ps-widget__content")
    .getByText(/^Logout$/i)
    .first();
  await expect(sidebarLogout).toBeVisible({ timeout: 15_000 });
  await sidebarLogout.scrollIntoViewIfNeeded();
  await sidebarLogout.click();
}

/**
 * Register a new buyer account on OneDirectBuy.
 * @returns {{ email: string; password: string; name: string }}
 */
export async function registerBuyer(page, overrides = {}) {
  const email = overrides.email || uniqueTestEmail();
  const password = overrides.password || DEFAULT_PASSWORD;
  const name = overrides.name || "Playwright Test Buyer";

  await gotoOneDirectBuy(page, "/account/register");
  await fillRegisterForm(page, { name, email, password });
  await page.getByRole("button", { name: /Create your account/i }).click();
  await expect(
    page.locator(".ant-notification-notice").filter({
      hasText: /Registration successful/i,
    }),
  ).toBeVisible({ timeout: 45_000 });
  try {
    await expectLoggedIn(page);
  } catch {
    await loginBuyer(page, email, password);
  }
  return { email, password, name };
}

/** Log in with email and password. */
export async function loginBuyer(page, email, password) {
  await gotoOneDirectBuy(page, "/account/login");
  await fillLoginForm(page, email, password);
  const submitBtn = page
    .getByRole("button", { name: /^Sign in$/i })
    .or(page.locator("button.account-auth__submit"))
    .or(page.getByRole("button", { name: /^Login$/i }))
    .first();
  await submitBtn.click();
  await expect(
    page.locator(".ant-notification-notice").filter({
      hasText: /Login successful/i,
    }),
  ).toBeVisible({ timeout: 20_000 });
  await expectLoggedIn(page);
}

/** Log out from the account menu. */
export async function logoutBuyer(page) {
  await clickLogout(page);
  await expect(page).toHaveURL(/\/account\/login|\//, { timeout: 15_000 });
}

async function sessionIsAuthenticated(page) {
  await gotoOneDirectBuy(page, "/account/orders");
  return !page.url().includes("/account/login");
}

/**
 * Resolve buyer credentials: env secrets first, otherwise a throwaway
 * storefront registration so authenticated cases can run without .env.
 */
export async function resolveBuyerCredentials(page) {
  if (hasBuyerCredentials()) {
    return ONE_DIRECT_BUY_BUYER_CREDENTIALS;
  }
  const created = await registerBuyer(page);
  ONE_DIRECT_BUY_BUYER_CREDENTIALS.email = created.email;
  ONE_DIRECT_BUY_BUYER_CREDENTIALS.password = created.password;
  return ONE_DIRECT_BUY_BUYER_CREDENTIALS;
}

/** Ensure a logged-in buyer using env secrets or a provisioned account. */
export async function ensureLoggedInBuyer(page) {
  const creds = await resolveBuyerCredentials(page);
  if (await sessionIsAuthenticated(page)) {
    return creds;
  }
  await loginBuyer(page, creds.email, creds.password);
  return creds;
}

/** Wipe Firebase/session storage so the next visit is a true guest. */
export async function wipeBuyerSession(page) {
  await page.context().clearCookies();
  await page.evaluate(async () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    if (!indexedDB.databases) return;
    const dbs = await indexedDB.databases();
    await Promise.all(
      (dbs || []).map(
        (db) =>
          new Promise((resolve) => {
            if (!db.name) return resolve();
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          }),
      ),
    );
  });
  await page.goto("about:blank");
}
export async function expectGuestRedirectToLogin(page, path) {
  await page.context().clearCookies();
  await gotoOneDirectBuy(page, path);
  await expect(page).toHaveURL(/\/account\/login/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: /^Welcome back$/i }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Log in as admin (same storefront login; admin role verified on dashboard). */
export async function loginAdmin(page) {
  if (!hasAdminCredentials()) {
    throw new Error(
      "Set ONEDIRECTBUY_ADMIN_EMAIL and ONEDIRECTBUY_ADMIN_PASSWORD in .env"
    );
  }
  await loginBuyer(
    page,
    ONE_DIRECT_BUY_ADMIN_CREDENTIALS.email,
    ONE_DIRECT_BUY_ADMIN_CREDENTIALS.password
  );
  return ONE_DIRECT_BUY_ADMIN_CREDENTIALS;
}
