import { expect } from "@playwright/test";
import { capturePageOrModal } from "./oneProductHubV2Capture.js";

export const ONE_PRODUCT_HUB_V2_BASE_URL =
  process.env.ONEPRODUCTHUB_BASE_URL ||
  process.env.ONEPRODUCTHUB_V2_BASE_URL ||
  "http://localhost:3000";

/**
 * API the tests rewrite localhost:4000 calls to. playwright.config.js sets it from
 * lib/targetGuard.cjs (local by default; the live backend only on a production read-only run).
 */
export const ONE_PRODUCT_HUB_V2_API_BASE =
  process.env.ONEPRODUCTHUB_API_BASE_URL ||
  "http://localhost:4000";

/** Credentials come only from env (.env or CI secrets); there are no fallbacks in code. */
const fromEnv = (...keys) => keys.map((k) => process.env[k]).find(Boolean) || "";

export const ONE_PRODUCT_HUB_V2_CLIENT_CREDENTIALS = {
  email: fromEnv("ONEPRODUCTHUB_CLIENT_EMAIL", "ONEPRODUCTHUB_V2_CLIENT_EMAIL"),
  password: fromEnv("ONEPRODUCTHUB_CLIENT_PASSWORD", "ONEPRODUCTHUB_V2_CLIENT_PASSWORD"),
};

export const ONE_PRODUCT_HUB_V2_BRAND_CREDENTIALS = {
  email: fromEnv("ONEPRODUCTHUB_BRAND_EMAIL", "ONEPRODUCTHUB_V2_BRAND_EMAIL"),
  password: fromEnv("ONEPRODUCTHUB_BRAND_PASSWORD", "ONEPRODUCTHUB_V2_BRAND_PASSWORD"),
};

export const ONE_PRODUCT_HUB_V2_ADMIN_CREDENTIALS = {
  email: fromEnv("ONEPRODUCTHUB_ADMIN_EMAIL", "ONEPRODUCTHUB_V2_ADMIN_EMAIL"),
  password: fromEnv("ONEPRODUCTHUB_ADMIN_PASSWORD", "ONEPRODUCTHUB_V2_ADMIN_PASSWORD"),
};

export function hasAdminCredentials() {
  return Boolean(
    ONE_PRODUCT_HUB_V2_ADMIN_CREDENTIALS.email &&
    ONE_PRODUCT_HUB_V2_ADMIN_CREDENTIALS.password,
  );
}

const VISIBILITY_TIMEOUT = 15_000;
const POST_SIGNIN_TIMEOUT = 30_000;

const rewriteInstalled = new WeakSet();

/**
 * Live site currently calls http://localhost:4000 for API.
 * Rewrite those requests to the production backend so E2E can run.
 * @param {import('@playwright/test').Page} page
 */
export async function ensureApiRewrite(page) {
  if (rewriteInstalled.has(page)) return;
  rewriteInstalled.add(page);

  await page.route("**/localhost:4000/**", async (route) => {
    const req = route.request();
    const target = req
      .url()
      .replace("http://localhost:4000", ONE_PRODUCT_HUB_V2_API_BASE)
      .replace("https://localhost:4000", ONE_PRODUCT_HUB_V2_API_BASE);
    try {
      const response = await route.fetch({ url: target });
      await route.fulfill({ response });
    } catch {
      try {
        await route.abort();
      } catch {
        // Request may already be fulfilled/aborted by a concurrent handler.
      }
    }
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {"Client" | "Brand"} role
 */
export async function openRoleSelection(page) {
  await ensureApiRewrite(page);
  await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
  await page.waitForLoadState("domcontentloaded");

  const roleButton = page.getByRole("button", {
    name: /Continue as (Brand|Client)/,
  }).first();
  await expect(async () => {
    if (await roleButton.isVisible().catch(() => false)) return;
    const loginButton = page.getByRole("button", {
      name: /^log\s*in$/i,
    });
    await expect(loginButton).toBeVisible({ timeout: 5_000 });
    await loginButton.click({ timeout: 5_000 });
    await expect(roleButton).toBeVisible({ timeout: 5_000 });
  }).toPass({
    timeout: 30_000,
    intervals: [500, 1_000, 2_000],
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {"Client" | "Brand"} role
 */
export async function openLoginForRole(page, role) {
  await openRoleSelection(page);
  const roleButton = page.getByRole("button", { name: `Continue as ${role}` });
  await roleButton.click();
  await capturePageOrModal(page, `Role selection — Continue as ${role}`);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string; password: string }} credentials
 */
export async function submitSignInForm(page, { email, password }) {
  if (!email || !password) {
    throw new Error(
      "Missing OneProductHub login: set ONEPRODUCTHUB_<CLIENT|BRAND|ADMIN>_EMAIL and _PASSWORD in .env.",
    );
  }
  const emailInput = page.getByRole("textbox", { name: "Email Address" });
  await expect(emailInput).toBeVisible({ timeout: VISIBILITY_TIMEOUT });
  await emailInput.fill(email);

  const passwordInput = page.getByRole("textbox", { name: "Password" });
  await expect(passwordInput).toBeVisible({ timeout: VISIBILITY_TIMEOUT });
  await passwordInput.fill(password);

  const signInButton = page.getByRole("button", { name: "Sign In" });
  await expect(signInButton).toBeEnabled({ timeout: VISIBILITY_TIMEOUT });
  await signInButton.click();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string; password?: string }} [credentials]
 */
export async function signInAsClient(page, credentials = {}) {
  const { email, password } = {
    ...ONE_PRODUCT_HUB_V2_CLIENT_CREDENTIALS,
    ...credentials,
  };

  await openLoginForRole(page, "Client");
  await submitSignInForm(page, { email, password });

  await expect(
    page.getByRole("heading", { name: /Welcome back,/i }),
  ).toBeVisible({ timeout: POST_SIGNIN_TIMEOUT });
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
    timeout: VISIBILITY_TIMEOUT,
  });
  await capturePageOrModal(page, "Client dashboard after sign-in");
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string; password?: string }} [credentials]
 */
export async function signInAsBrand(page, credentials = {}) {
  const { email, password } = {
    ...ONE_PRODUCT_HUB_V2_BRAND_CREDENTIALS,
    ...credentials,
  };

  await openLoginForRole(page, "Brand");
  await submitSignInForm(page, { email, password });

  await expect(
    page.getByRole("heading", { name: "Workspace Overview" }),
  ).toBeVisible({ timeout: POST_SIGNIN_TIMEOUT });
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
    timeout: VISIBILITY_TIMEOUT,
  });
  await capturePageOrModal(page, "Brand workspace after sign-in");
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string; password?: string }} [credentials]
 */
export async function signInAsAdmin(page, credentials = {}) {
  const { email, password } = {
    ...ONE_PRODUCT_HUB_V2_ADMIN_CREDENTIALS,
    ...credentials,
  };

  if (!email || !password) {
    throw new Error(
      "Admin credentials not configured. Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD.",
    );
  }

  await openLoginForRole(page, "Brand");
  await submitSignInForm(page, { email, password });

  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible({
    timeout: POST_SIGNIN_TIMEOUT,
  });
  await expect(page.getByText("Superadmin").first()).toBeVisible({
    timeout: VISIBILITY_TIMEOUT,
  });
  await capturePageOrModal(page, "Admin portal after sign-in");
}
