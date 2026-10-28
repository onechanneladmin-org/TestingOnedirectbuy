// Login fixture for the E2E flows (project "flows-setup"): signs the QA user in, pins the test org,
// verifies the guard, and saves the session (cookies + localStorage + Firebase IndexedDB) to
// playwright/.auth/e2e-user.json (gitignored). Ported from onechanneladmin-latest apps/web/e2e/auth.setup.js.
//
// Env (this project's .env or the hub .env, both gitignored): E2E_USER_EMAIL, E2E_USER_PASSWORD,
// E2E_ORG_ID, optional E2E_USER_TOTP_SECRET (base32) or E2E_USER_TOTP (one-off code).
// A8 also signs in E2E_LOWPERM_EMAIL / E2E_LOWPERM_PASSWORD when set.
const fs = require("fs");
const path = require("path");
const { test: setup, expect } = require("@playwright/test");
const { e2eSettings, AUTH_FILE, LOWPERM_AUTH_FILE } = require("./support/env");
const G = require("./support/guard");
const { totpNow } = require("./support/totp");

const LOGIN_PATH = "/v2/login";
const offLogin = (url) => !/^\/(v2\/login|signin|login)/.test(new URL(url).pathname);

async function signIn(page, { email, password, totp, totpSecret, orgId }) {
  await page.goto(LOGIN_PATH);
  // /v2/login uses name="emailId"; the older /signin form labels it "Email address".
  const emailBox = page.locator('input[name="emailId"]').or(page.getByRole("textbox", { name: "Email address" }));
  await emailBox.first().fill(email);
  await page.locator('input[name="password"], #password input').first().fill(password);
  await page.locator('form button[type="submit"]').or(page.getByRole("button", { name: "Login" })).first().click();

  // Either the MFA code field appears or we leave the login page.
  const codeInput = page.locator('input[name="smscode"]');
  const outcome = await Promise.race([
    codeInput.waitFor({ state: "visible", timeout: 30_000 }).then(() => "mfa", () => null),
    page.waitForURL(offLogin, { timeout: 30_000 }).then(() => "in", () => null),
  ]);
  if (outcome === "mfa") {
    const code = totp || totpNow(totpSecret);
    if (!code) throw new Error("User has MFA: set its TOTP secret (base32) in .env.");
    await codeInput.fill(code);
    await page.getByRole("button", { name: "Submit Code" }).click();
    await page.waitForURL(offLogin, { timeout: 30_000 });
  } else if (outcome !== "in") {
    const err = await page.locator(".p-error, .p-toast-message").allInnerTexts().catch(() => []);
    throw new Error(`Login did not complete within 30s${err.length ? `: ${err.join(" | ").slice(0, 200)}` : ""}`);
  }

  // Pin the test org, reload, and make sure the app kept it (a user without access to the org
  // gets bounced to another one — that must fail here, before any spec runs).
  // The app's bootstrap writes the user's default org asynchronously and can win the race against
  // our pin (seen: "oneauto"), so pin → reload → settle, up to 3 times.
  let current = null;
  for (let attempt = 0; attempt < 3 && current !== orgId; attempt += 1) {
    await page.evaluate((org) => {
      localStorage.setItem("currentorganization", org);
      localStorage.setItem("currentorganization_reset", org);
    }, orgId);
    await page.goto("/");
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    current = await page.evaluate(() => localStorage.getItem("currentorganization"));
  }
  expect(current, "app switched away from E2E_ORG_ID — is the user a member of it?").toBe(orgId);
  G.assertTestOrg(current, process.env);
}

setup("sign in as the QA user on the test org @setup", async ({ page }) => {
  const s = e2eSettings();
  G.assertTestOrg(s.orgId, process.env);
  if (!s.email || !s.password) {
    throw new Error("Set E2E_USER_EMAIL and E2E_USER_PASSWORD in .env (gitignored, never commit it).");
  }
  await signIn(page, s);
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE, indexedDB: true });
});

setup("sign in as the low-permission user (A8) @setup", async ({ browser }) => {
  const s = e2eSettings();
  setup.skip(!s.lowPermEmail || !s.lowPermPassword, "E2E_LOWPERM_EMAIL / E2E_LOWPERM_PASSWORD not set (A8 will skip)");
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, {
    email: s.lowPermEmail,
    password: s.lowPermPassword,
    totpSecret: s.lowPermTotpSecret,
    orgId: s.orgId,
  });
  fs.mkdirSync(path.dirname(LOWPERM_AUTH_FILE), { recursive: true });
  await context.storageState({ path: LOWPERM_AUTH_FILE, indexedDB: true });
  await context.close();
});
