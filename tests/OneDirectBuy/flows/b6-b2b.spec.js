// @flow B6 — B2B / business buyer. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 B6.
// Use cases: production QA sheet QA-061, 064, 065, 069, 070, 071 (ODB B2B / business buyers).
//
// Current product rules (production-qa.tsv, owner decision 2026-10): there is NO shared org credit or
// terms checkout any more — checkout is the buyer's own wallet checkbox + Stripe; the business team is
// for org attribution only; B2B prices are still taxed unless an approved tax certificate covers the
// ship-to state. The guide's older "credit/terms checkout, PO" steps are therefore checked as ABSENT.
//
// Public checks run anywhere (read-only). Signed-in checks need a B2B test buyer:
//   ODB_B2B_LOGIN=1, ONEDIRECTBUY_B2B_EMAIL / ONEDIRECTBUY_B2B_PASSWORD (gitignored .env only),
// and a non-production target (the checkout check writes a cart). Nothing is paid here.
import { test, expect, go, passChallenge } from "./fixtures.js";
import { checkStep } from "../../helpers/checkStep.js";
import { fillLoginForm } from "../../helpers/oneDirectBuyAuth.js";
import { clearCart, addProductAndOpenCart, proceedToCheckout, fillCheckoutShipping } from "../../helpers/buyerPurchaseJourney.js";

const B2B = { email: process.env.ONEDIRECTBUY_B2B_EMAIL || "", password: process.env.ONEDIRECTBUY_B2B_PASSWORD || "" };
const hasB2B = () => process.env.ODB_B2B_LOGIN === "1" && Boolean(B2B.email && B2B.password);

async function signInB2B(page, odb) {
  const auth = { token: null };
  page.on("request", (r) => {
    const h = r.headers().authorization;
    if (!auth.token && h && r.url().startsWith(odb.apiURL)) auth.token = h;
  });
  await go(page, "/account/login");
  await fillLoginForm(page, B2B.email, B2B.password);
  await page.getByRole("button", { name: /^Sign in$/i }).first().click();
  await expect(page).not.toHaveURL(/\/account\/login$/, { timeout: 30_000 });
  await go(page, "/account/my-account");
  await expect.poll(() => auth.token, { message: "buyer token seen on an API call", timeout: 30_000 }).toBeTruthy();
  return auth;
}

test.describe("B6 B2B buyer @flow", () => {
  test("QA-071 the retired /account/b2b-credits URL redirects to the wallet (no broken page)", async ({ page, health, odb }, testInfo) => {
    const res = await fetch(`${odb.baseURL}/account/b2b-credits`, { redirect: "manual" });
    expect([301, 302, 307, 308], `/account/b2b-credits → ${res.status}`).toContain(res.status);
    expect(res.headers.get("location") || "", "redirect target").toMatch(/\/account\/wallet/);
    await go(page, "/account/b2b-credits");
    await expect(page, "lands on the wallet (or its login gate)").toHaveURL(/\/account\/(wallet|login)/);
    await passChallenge(page);
    await expect(page.getByRole("heading", { name: /Welcome back|Wallet/i }).first(), "wallet or login page rendered").toBeVisible();
    await checkStep(page, testInfo, { id: "QA-071", name: "b2b-credits redirect", health });
  });

  test.describe("signed in as the B2B test buyer", () => {
    test.beforeEach(() => {
      test.skip(!hasB2B(), "set ODB_B2B_LOGIN=1 and ONEDIRECTBUY_B2B_EMAIL / _PASSWORD (B2B test buyer: owner to provide)");
    });

    test("QA-065 / 069 business team page = GET /user/b2b-account; wallet is per person", async ({ page, health, odb }, testInfo) => {
      const auth = await signInB2B(page, odb);
      const res = await fetch(`${odb.apiURL}/user/b2b-account`, { headers: { authorization: auth.token } });
      expect(res.status, "GET /user/b2b-account").toBe(200);
      const body = await res.json();
      const account = body.account || null;

      await go(page, "/account/b2b-team");
      await expect(page.getByRole("heading", { level: 1, name: /Business team/i })).toBeVisible();
      await expect(page.getByText(/Each person still uses their own/i), "wallet is per person").toBeVisible();
      if (!account) {
        await expect(page.getByRole("heading", { name: /No business team linked/i })).toBeVisible();
      } else {
        const members = (account.members || []).filter((m) => m.status !== "removed");
        const list = page.getByLabel("Team members");
        await expect(list).toBeVisible();
        for (const m of members.slice(0, 10)) {
          await expect(list.getByText(m.email, { exact: false }).first(), `member ${m.status} listed`).toBeVisible();
        }
      }
      await expect(page.getByText(/shared credit|credit pool|org credit/i), "no shared org credit wording").toHaveCount(0);
      await checkStep(page, testInfo, { id: "QA-065", name: "business team", health });
    });

    test("QA-061 / 064 / 070 checkout: wallet + card only, tax line kept, tax-certificate link", async ({ page, health, odb }, testInfo) => {
      test.skip(!odb.writable, "writes a cart: needs a non-production target");
      await signInB2B(page, odb);
      await clearCart(page);
      await addProductAndOpenCart(page);
      await proceedToCheckout(page);
      await fillCheckoutShipping(page);

      const payment = page.getByRole("heading", { name: /^Payment$/ }).first();
      await expect(payment).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByRole("button", { name: /org(anization)? credit|business credit|pay on terms|net ?\d+/i }),
        "no org-credit / terms payment option",
      ).toHaveCount(0);
      await expect(page.locator('a[href*="#tax-certificates"]').first(), "link to tax certificates").toBeVisible();
      await expect(page.getByText(/separate from sales tax\s+exemption/i).first()).toBeVisible();
      // QA-064: a B2B price is not a tax exemption — the summary still has a Tax line (the fixed test
      // address is in Florida, which is taxed unless the buyer has an approved FL certificate).
      await expect(page.getByText(/^\s*Tax\b/i).first(), "tax line shown for the B2B buyer").toBeVisible();
      await checkStep(page, testInfo, { id: "QA-061", name: "b2b checkout payment", health });
      await clearCart(page);
    });
  });
});
