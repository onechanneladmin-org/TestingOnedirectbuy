import { test, expect } from "../../fixtures/zukaTest.js";
import { auditScreen, MOBILE, DESKTOP } from "../../helpers/zukaUiAudit.js";
import { CUSTOMER_URL } from "../../helpers/zukaEnv.js";

/** Theme / UX audit — zukaongo.com marketing pages and the customer sign-in screens. */
const MARKETING = [
  { id: "ZUKA-UI-PUB-01", name: "Landing", path: "/", ready: (p) => p.getByRole("button", { name: "Find food" }) },
  { id: "ZUKA-UI-PUB-02", name: "Partner apply", path: "/partner", ready: (p) => p.getByRole("heading", { name: "Become a ZUKAongo partner" }) },
  { id: "ZUKA-UI-PUB-03", name: "Driver apply", path: "/partner?type=driver", ready: (p) => p.getByRole("button", { name: "Apply to deliver" }) },
  { id: "ZUKA-UI-PUB-04", name: "Terms", path: "/terms", ready: (p) => p.getByRole("heading", { name: "Terms of use" }) },
  { id: "ZUKA-UI-PUB-05", name: "Privacy", path: "/privacy", ready: (p) => p.getByRole("heading", { name: "Privacy policy" }) },
  { id: "ZUKA-UI-PUB-06", name: "Contact", path: "/contact", ready: (p) => p.getByRole("heading", { name: "Contact us" }) },
  { id: "ZUKA-UI-PUB-07", name: "Delete account", path: "/delete-account", ready: (p) => p.getByRole("heading", { name: "Delete your account" }) },
];
const APP_ENTRY = [
  { id: "ZUKA-UI-PUB-08", name: "Customer sign in", path: "/login", ready: (p) => p.getByRole("button", { name: "Sign in", exact: true }) },
  { id: "ZUKA-UI-PUB-09", name: "Create account", path: "/signup", ready: (p) => p.getByRole("button", { name: "Create account" }) },
  { id: "ZUKA-UI-PUB-10", name: "Forgot password", path: "/forgot", ready: (p) => p.getByRole("button", { name: "Send reset link" }) },
];

for (const [label, viewport, mobile] of [["desktop", DESKTOP, false], ["mobile", MOBILE, true]]) {
  test.describe(`UI audit — public site (${label})`, () => {
    test.use({ viewport });

    test(`marketing pages follow the ZUKAongo theme (${label})`, async ({ page, soft }, testInfo) => {
      for (const s of MARKETING) {
        await soft(`${s.id}-${label}`, `Audit ${s.name} (${label})`, async () => {
          await auditScreen(page, { surface: "marketing", pageName: s.name, mobile, testInfo }, async () => {
            await page.goto(`${CUSTOMER_URL}${s.path}`, { waitUntil: "domcontentloaded" });
            await expect(s.ready(page).first()).toBeVisible({ timeout: 45_000 });
          });
        });
      }
    });

    test(`customer sign-in screens follow the app theme (${label})`, async ({ page, soft }, testInfo) => {
      for (const s of APP_ENTRY) {
        await soft(`${s.id}-${label}`, `Audit ${s.name} (${label})`, async () => {
          await auditScreen(page, { surface: "customer", pageName: s.name, mobile, testInfo }, async () => {
            await page.goto(`${CUSTOMER_URL}${s.path}`, { waitUntil: "domcontentloaded" });
            await expect(s.ready(page)).toBeVisible({ timeout: 45_000 });
          });
        });
      }
    });
  });
}

test("keyboard focus is visible on the landing page", async ({ page, soft }) => {
  await soft("ZUKA-UI-PUB-11", "Tabbing through the header shows a visible focus indicator", async () => {
    await page.goto(`${CUSTOMER_URL}/`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Find food" })).toBeVisible();
    const missing = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const visible = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
        return { name: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40), visible };
      });
      if (info && !info.visible) missing.push(info.name);
    }
    expect(missing, "focusable elements without a focus ring").toEqual([]);
  });
});
