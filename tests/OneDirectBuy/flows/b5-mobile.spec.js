// @flow B5 — Mobile (390×844). Guide: docs/qa/E2E-TEST-GUIDE.md § 5 B5. Use cases: ODB-UC-039 (+ B1 screens at phone size).
// checkStep at 390 px fails on horizontal overflow, off-screen controls and tap targets under 24 px.
import { test, expect, go, productHrefs } from "./fixtures.js";
import { checkStep } from "../../helpers/checkStep.js";

const KEYWORD = process.env.ODB_SEARCH_KEYWORD || "wheel";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.describe("B5 mobile @flow", () => {
  test("ODB-UC-039 phone: home, menu drawer, search, product and cart fit the screen", async ({ page, health, odb }, testInfo) => {
    await go(page, "/");
    await checkStep(page, testInfo, { id: "ODB-UC-039", name: "home 390", health });

    const menu = page.getByRole("button", { name: /menu|Shop by Department/i }).first();
    await menu.click();
    const drawer = page.locator(".ant-drawer-open, [role=dialog], .ps-panel--sidebar.active").first();
    await expect(drawer, "menu drawer opens").toBeVisible();
    await checkStep(page, testInfo, { id: "ODB-UC-039", name: "menu drawer 390", health });
    await page.keyboard.press("Escape");

    await go(page, `/search?keyword=${KEYWORD}`);
    await expect(page.getByText(/\d+ record\(s\) found/i).first()).toBeVisible();
    await checkStep(page, testInfo, { id: "ODB-UC-039", name: "search 390", health });

    const href = (await productHrefs(page))[0];
    await go(page, href);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await checkStep(page, testInfo, { id: "ODB-UC-039", name: "product 390", health });

    if (odb.writable) {
      await go(page, "/account/shopping-cart");
      await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
      await checkStep(page, testInfo, { id: "ODB-UC-039", name: "cart 390", health });
    }
  });
});
