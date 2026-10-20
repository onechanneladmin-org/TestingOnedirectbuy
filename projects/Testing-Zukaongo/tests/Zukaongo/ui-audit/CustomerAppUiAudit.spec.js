import { test, expect } from "../../fixtures/zukaTest.js";
import { auditScreen, MOBILE, DESKTOP } from "../../helpers/zukaUiAudit.js";
import { signIn } from "../../helpers/zukaAuth.js";
import { setDeliveryLocation, customerOrders, openLocationPicker } from "../../helpers/zukaCustomer.js";
import { CUSTOMER_URL, E2E_VENDOR } from "../../helpers/zukaEnv.js";

/** Theme / UX audit — signed-in customer web app (desktop + phone width). */
const h1 = (name) => (p) => p.getByRole("heading", { name, level: 1 }).first();

for (const [label, viewport, mobile] of [["desktop", DESKTOP, false], ["mobile", MOBILE, true]]) {
  test.describe(`UI audit — customer app (${label})`, () => {
    test.use({ viewport });

    test(`customer screens follow the app theme (${label})`, async ({ page, soft }, testInfo) => {
      await signIn(page, "customer");
      await setDeliveryLocation(page, "KY1-1201");
      const delivered = (await customerOrders(page)).find((o) => o.fulfillment === "delivered");
      const screens = [
        { id: "01", name: "Home", path: "/", ready: (p) => p.getByRole("heading", { name: "Popular restaurants" }) },
        { id: "02", name: "Restaurants directory", path: "/places?mode=restaurant", ready: h1("Restaurants") },
        { id: "03", name: "Restaurant menu", path: `/vendor/${E2E_VENDOR.id}`, ready: h1(E2E_VENDOR.name) },
        { id: "04", name: "Product detail", path: "/product/bh-fries", ready: h1("Fries") },
        { id: "05", name: "Cart", path: "/cart", ready: h1("Cart") },
        { id: "06", name: "Orders", path: "/orders", ready: h1("Orders") },
        ...(delivered
          ? [{ id: "07", name: "Track delivered order", path: `/orders/track/${encodeURIComponent(encodeURIComponent(delivered.id))}`, ready: h1("Track order") }]
          : []),
        { id: "08", name: "Profile", path: "/profile", ready: h1("Profile") },
        { id: "09", name: "Wallet", path: "/profile/menu/Wallet", ready: h1("Wallet") },
        { id: "10", name: "Help & support", path: "/profile/menu/Help", ready: h1("Help & support") },
      ];
      for (const s of screens) {
        await soft(`ZUKA-UI-CUS-${s.id}-${label}`, `Audit ${s.name} (${label})`, async () => {
          await auditScreen(page, { surface: "customer", pageName: s.name, mobile, testInfo }, async () => {
            await page.goto(`${CUSTOMER_URL}${s.path}`, { waitUntil: "domcontentloaded" });
            await expect(s.ready(page)).toBeVisible({ timeout: 45_000 });
          });
        });
      }
      await soft(`ZUKA-UI-CUS-11-${label}`, `Audit location picker dialog (${label})`, async () => {
        // Overlays: open them first, then audit without timing (Home load time is audited above).
        await page.goto(`${CUSTOMER_URL}/`, { waitUntil: "domcontentloaded" });
        await openLocationPicker(page);
        await auditScreen(page, { surface: "customer", pageName: "Location picker", mobile, testInfo });
      });
      await soft(`ZUKA-UI-CUS-12-${label}`, `Audit assistant chat panel (${label})`, async () => {
        await page.goto(`${CUSTOMER_URL}/orders`, { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "Open assistant" }).click();
        await expect(page.getByText(/Hi! I'm Zuka/)).toBeVisible({ timeout: 45_000 });
        await auditScreen(page, { surface: "customer", pageName: "Assistant chat", mobile, testInfo });
      });
    });
  });
}
