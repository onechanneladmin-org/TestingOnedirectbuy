import { test, expect } from "../../fixtures/zukaTest.js";
import { CUSTOMER_URL, STEP_TIMEOUT } from "../../helpers/zukaEnv.js";

/** zukaongo.com marketing site and legal pages (no sign-in). */
test.describe("ZUKAongo — public site", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/`, { waitUntil: "domcontentloaded" });
  });

  test("landing page explains the service, fees and delivery areas", async ({ page, soft }) => {
    await soft("ZUKA-PUB-01", "Landing page title and Grand Cayman hero headline", async () => {
      await expect(page).toHaveTitle(/ZUKAongo/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/delivered across Grand Cayman/i);
    });
    await soft("ZUKA-PUB-02", "Header links: What you can order, For restaurants, Drive with us, Order now", async () => {
      await expect(page.getByRole("link", { name: "What you can order" })).toHaveAttribute("href", "#order");
      await expect(page.getByRole("link", { name: "For restaurants" })).toHaveAttribute("href", "#partners");
      await expect(page.getByRole("link", { name: "Drive with us" }).first()).toHaveAttribute("href", "/partner?type=driver");
      await expect(page.getByRole("link", { name: "Order now" }).first()).toHaveAttribute("href", "/?app=1");
    });
    await soft("ZUKA-PUB-03", "Skip-to-content link is present for keyboard users", async () => {
      await expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    });
    await soft("ZUKA-PUB-04", "Fees are shown in CI$: delivery from CI$1.99, free over CI$40, pickup no fees", async () => {
      await expect(page.getByText("from CI$1.99").first()).toBeVisible();
      await expect(page.getByText("Orders over CI$40").first()).toBeVisible();
      await expect(page.getByText("Pickup orders").first()).toBeVisible();
      await expect(page.getByText("No fees").first()).toBeVisible();
    });
    await soft("ZUKA-PUB-05", "Delivery areas list George Town, Seven Mile Beach, Camana Bay, West Bay", async () => {
      for (const area of ["George Town", "Seven Mile Beach", "Camana Bay", "West Bay", "Bodden Town"]) {
        await expect(page.getByText(area, { exact: true }).first()).toBeVisible();
      }
    });
    await soft("ZUKA-PUB-06", "App Store and Google Play links point to the ZukaOngo apps", async () => {
      await expect(page.locator('a[href^="https://apps.apple.com/"]').first()).toBeVisible();
      await expect(page.locator('a[href*="play.google.com/store/apps/details?id=com.zukanongo"]').first()).toBeVisible();
    });
    await soft("ZUKA-PUB-07", "Partner CTAs link to /partner and the partner web app", async () => {
      await expect(page.locator('a[href="/partner"]').first()).toBeVisible();
      await expect(page.locator('a[href^="https://partners.zukaongo.com"]').first()).toBeAttached();
      await expect(page.locator('a[href="mailto:support@zukaongo.com"]').first()).toBeAttached();
    });
  });

  test("hero postal-code search takes the shopper into the app", async ({ page, soft }) => {
    await soft("ZUKA-PUB-08", "Typing KY1-1201 and pressing Find food opens the ordering app", async () => {
      await page.getByRole("textbox", { name: /KY1-1201|address or postal code/i }).fill("KY1-1201");
      await page.getByRole("button", { name: "Find food" }).click();
      await expect(page).not.toHaveURL(`${CUSTOMER_URL}/`, { timeout: STEP_TIMEOUT });
      await expect(
        page.locator('input[type="email"]').or(page.getByRole("tab", { name: /^Home$/ })).first(),
      ).toBeVisible({ timeout: 45_000 });
    });
  });

  const LEGAL = [
    { id: "ZUKA-PUB-10", path: "/terms", title: /Terms of Use/, h1: "Terms of use" },
    { id: "ZUKA-PUB-11", path: "/privacy", title: /Privacy Policy/, h1: "Privacy policy" },
    { id: "ZUKA-PUB-12", path: "/cookies", title: /Cookie Notice/, h1: "Cookie notice" },
    { id: "ZUKA-PUB-13", path: "/contact", title: /Contact Us/, h1: "Contact us" },
    { id: "ZUKA-PUB-14", path: "/delete-account", title: /Delete Your Account/, h1: "Delete your account" },
  ];

  test("legal and support pages load with the site header and footer", async ({ page, soft }) => {
    for (const p of LEGAL) {
      await soft(p.id, `${p.path} shows "${p.h1}" with header and footer`, async () => {
        await page.goto(`${CUSTOMER_URL}${p.path}`, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveTitle(p.title);
        await expect(page.getByRole("heading", { name: p.h1, level: 1 })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
        await expect(page.getByRole("contentinfo")).toContainText("support@zukaongo.com");
      });
    }
    await soft("ZUKA-PUB-15", "Terms and Privacy show a 'Last updated' date", async () => {
      for (const path of ["/terms", "/privacy"]) {
        await page.goto(`${CUSTOMER_URL}${path}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByText(/Last updated \w+ \d{1,2}, \d{4}/)).toBeVisible();
      }
    });
    await soft("ZUKA-PUB-16", "Delete-account page explains the 30-day deletion path", async () => {
      await page.goto(`${CUSTOMER_URL}/delete-account`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("30 days")).toBeVisible();
      await expect(page.getByText("Profile → Security & privacy → Delete account")).toBeVisible();
    });
  });

  test("contact form validates before sending", async ({ page, soft }) => {
    await soft("ZUKA-PUB-17", "Contact form has Name, Email and Message", async () => {
      await page.goto(`${CUSTOMER_URL}/contact`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("textbox", { name: "Name" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    });
    await soft("ZUKA-PUB-18", "Send message with empty fields is blocked with a validation message", async () => {
      await page.getByRole("button", { name: "Send message" }).click();
      const invalid = await page.getByRole("textbox", { name: "Name" }).evaluate((el) => !el.checkValidity?.() || false);
      const msg = page.getByRole("status").or(page.getByRole("alert")).or(page.getByText(/enter|required|valid/i));
      expect(invalid || (await msg.first().isVisible().catch(() => false))).toBeTruthy();
      await expect(page.getByText(/thanks|we received|message sent/i)).toHaveCount(0);
    });
  });
});
