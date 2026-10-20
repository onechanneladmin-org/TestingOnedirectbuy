import { test, expect } from "../../fixtures/zukaTest.js";
import { auditScreen } from "../../helpers/zukaUiAudit.js";
import { signIn, openLogin } from "../../helpers/zukaAuth.js";
import { ADMIN_URL, ADMIN_SECTIONS, RECEPTION_NAV } from "../../helpers/zukaEnv.js";

/** Theme / UX audit — admin.zukaongo.com for superadmin and a restaurant (reception) login. */
test.describe("UI audit — admin console", () => {
  test("admin sign-in screen", async ({ page, soft }, testInfo) => {
    await soft("ZUKA-UI-ADM-00", "Audit admin sign in", async () => {
      await auditScreen(page, { surface: "admin", pageName: "Admin sign in", testInfo }, async () => {
        await openLogin(page, "admin");
        await expect(page.getByRole("heading", { name: "Sign in to Zuka" })).toBeVisible();
      });
    });
  });

  test("every superadmin section follows the admin theme", async ({ page, soft }, testInfo) => {
    await signIn(page, "admin");
    for (const s of ADMIN_SECTIONS) {
      await soft(s.id.replace("ADM-NAV", "UI-ADM"), `Audit ${s.nav}`, async () => {
        await auditScreen(page, { surface: "admin", pageName: `Superadmin · ${s.nav}`, testInfo }, async () => {
          await page.goto(`${ADMIN_URL}${s.path}`, { waitUntil: "domcontentloaded" });
          await expect(page.getByRole("heading", { name: s.heading, exact: true }).first()).toBeVisible({ timeout: 45_000 });
        });
      });
    }
    await soft("ZUKA-UI-ADM-15", "Audit vendor detail (Burger House)", async () => {
      await auditScreen(page, { surface: "admin", pageName: "Superadmin · Vendor detail", testInfo }, async () => {
        await page.goto(`${ADMIN_URL}/vendors/burger-house`, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("tablist", { name: "Vendor sections" })).toBeVisible({ timeout: 45_000 });
      });
    });
  });

  test("restaurant (reception) screens follow the admin theme", async ({ page, soft }, testInfo) => {
    await signIn(page, "kitchen");
    const paths = { Vendors: "/", Orders: "/orders", Reservations: "/reservations", "Meal pass": "/meal-pass", Kitchen: "/kitchen", Drive: "/drive", Analytics: "/analytics" };
    for (const [i, nav] of RECEPTION_NAV.entries()) {
      await soft(`ZUKA-UI-REC-${String(i + 1).padStart(2, "0")}`, `Audit reception ${nav}`, async () => {
        await auditScreen(page, { surface: "admin", pageName: `Reception · ${nav}`, testInfo }, async () => {
          await page.goto(`${ADMIN_URL}${paths[nav]}`, { waitUntil: "domcontentloaded" });
          await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible({ timeout: 45_000 });
        });
      });
    }
  });
});
