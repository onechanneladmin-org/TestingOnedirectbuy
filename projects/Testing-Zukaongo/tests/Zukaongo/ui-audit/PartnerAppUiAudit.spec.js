import { test, expect } from "../../fixtures/zukaTest.js";
import { auditScreen, MOBILE, DESKTOP } from "../../helpers/zukaUiAudit.js";
import { signIn, openLogin } from "../../helpers/zukaAuth.js";
import { PARTNER_URL } from "../../helpers/zukaEnv.js";

/** Theme / UX audit — drivers.zukaongo.com partner app; drivers use it on phones. */
for (const [label, viewport, mobile] of [["mobile", MOBILE, true], ["desktop", DESKTOP, false]]) {
  test.describe(`UI audit — partner app (${label})`, () => {
    test.use({ viewport });

    test(`partner screens follow the theme (${label})`, async ({ page, soft }, testInfo) => {
      await soft(`ZUKA-UI-PRT-01-${label}`, `Audit partner sign in (${label})`, async () => {
        await auditScreen(page, { surface: "partner", pageName: "Partner sign in", mobile, testInfo }, async () => {
          await openLogin(page, "partner");
          await expect(page.getByRole("heading", { name: "ZukaOngo Partner" })).toBeVisible();
        });
      });
      await signIn(page, "driver2");
      const offer = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Decline" }) });
      await page.addLocatorHandler(offer, async () => {
        await offer.getByRole("button", { name: "Decline" }).click().catch(() => {});
      });
      await soft(`ZUKA-UI-PRT-02-${label}`, `Audit Deliveries (${label})`, async () => {
        await auditScreen(page, { surface: "partner", pageName: "Deliveries", mobile, testInfo }, async () => {
          await page.goto(`${PARTNER_URL}/`, { waitUntil: "domcontentloaded" });
          await expect(page.getByRole("heading", { name: "Deliveries", level: 1 })).toBeVisible({ timeout: 45_000 });
        });
      });
      await soft(`ZUKA-UI-PRT-03-${label}`, `Audit Partner settings (${label})`, async () => {
        await auditScreen(page, { surface: "partner", pageName: "Partner settings", mobile, testInfo }, async () => {
          await page.goto(`${PARTNER_URL}/settings`, { waitUntil: "domcontentloaded" });
          await expect(page.getByRole("heading", { name: "Partner settings" })).toBeVisible({ timeout: 45_000 });
        });
      });
    });
  });
}
