/**
 * Catalog > Products > Variations: open SKU in new window, link existing variation, save.
 *
 * Optional env: PLAYWRIGHT_BASE_URL, TEST_LOGIN_EMAIL, TEST_LOGIN_PASSWORD,
 * TEST_CATALOG_PRODUCT_NAME (product link text), TEST_VARIATION_SKU (link text that opens popup)
 */
import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "https://admin.onechanneladmin.com";
const LOGIN_EMAIL =
  process.env.TEST_LOGIN_EMAIL || "admin@onechanneladmin.com";
const LOGIN_PASSWORD =
  process.env.TEST_LOGIN_PASSWORD || (process.env.TEST_LOGIN_PASSWORD || "");
const PRODUCT_NAME =
  process.env.TEST_CATALOG_PRODUCT_NAME || "AIR_LIFT57230_DUPLICATE1";
const VARIATION_SKU =
  process.env.TEST_VARIATION_SKU || "SKU21102024";

test.describe("Catalog product variations", () => {
  test.beforeEach(async ({ page }) => {
    await loginOneChannelAdmin(page, {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    });
    await expect(page.getByRole("button", { name: "Catalog" })).toBeVisible({
      timeout: 20000,
    });
    await page.getByRole("button", { name: "Catalog" }).click();
    await page.getByRole("link", { name: "Products" }).click();
  });

  test("opens variation SKU in popup, links existing variation, saves", async ({
    page,
  }) => {
    await test.step("Open product detail", async () => {
      await page.getByRole("link", { name: PRODUCT_NAME }).click();
    });

    await test.step("Open Variations tab", async () => {
      await page.getByRole("tab", { name: "Variations" }).click();
      await expect(
        page.getByRole("link", { name: VARIATION_SKU })
      ).toBeVisible({ timeout: 15000 });
    });

    await test.step("Column panel toggle (#columns-resize)", async () => {
      const columnsResize = page.locator("#columns-resize");
      await expect(columnsResize).toBeVisible({ timeout: 15000 });
      await columnsResize.click();
      await columnsResize.click();
    });

    let popup;
    await test.step("Open variation SKU in new window (popup)", async () => {
      const popupPromise = page.waitForEvent("popup", {
        timeout: 60000,
      });
      await page.getByRole("link", { name: VARIATION_SKU }).click();
      popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded");
    });

    await test.step("Popup: Variations tab", async () => {
      await popup.getByRole("tab", { name: "Variations" }).click();
    });

    await test.step("Link Existing + pick row in dialog", async () => {
      await popup.getByRole("button", { name: /^\s*Link Existing\s*$/i }).click();

      // Picker may be dialog, sidebar, or drawer — wait for rows, then the overlay that holds the grid.
      await expect(popup.locator("table tbody tr").first()).toBeVisible({
        timeout: 20000,
      });

      // Do not require Confirm inside this node — some apps portal the footer to body.
      const overlaySelector = [
        '.p-dialog',
        '[role="dialog"]',
        ".p-sidebar",
        ".p-drawer",
        ".p-overlaypanel",
      ].join(", ");
      const pickerRoot = popup
        .locator(overlaySelector)
        .filter({ has: popup.locator("table tbody tr") })
        .last();
      await expect(pickerRoot).toBeVisible({ timeout: 10000 });

      const firstDataRow = pickerRoot.locator("table tbody tr").first();

      // PrimeNG: visible hit target is usually .p-checkbox-box; input may be hidden.
      const primeCheckbox = firstDataRow.locator(".p-checkbox-box").first();
      if (await primeCheckbox.isVisible().catch(() => false)) {
        await primeCheckbox.click();
      } else {
        const hiddenInput = firstDataRow.locator('input[type="checkbox"]');
        if (await hiddenInput.count()) {
          await hiddenInput.click({ force: true });
        } else {
          await firstDataRow.locator(".p-selection-column").first().click();
        }
      }

      // Footer sits below the grid; scroll the panel so Confirm is in the clickable viewport.
      await pickerRoot.evaluate((root) => {
        const inner =
          root.querySelector(
            ".p-dialog-content, .p-sidebar-content, .p-drawer-content, .p-overlaypanel-content"
          ) || root;
        inner.scrollTop = inner.scrollHeight;
      });
      await popup.waitForTimeout(300);

      const footer = popup
        .locator(
          ".p-dialog-footer, .p-sidebar-footer, .p-drawer-footer, [class*='DialogFooter']"
        )
        .last();
      if (await footer.isVisible().catch(() => false)) {
        await footer.scrollIntoViewIfNeeded();
      }

      // Confirm may be in a portal (sibling of dialog) — scroll the popup window too.
      await popup.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });

      const confirmBtn = popup
        .getByRole("button", { name: /Confirm Selection/i })
        .last();
      await confirmBtn.scrollIntoViewIfNeeded();
      await expect(confirmBtn).toBeVisible({ timeout: 15000 });
      await expect(confirmBtn).toBeEnabled({ timeout: 15000 });
      await confirmBtn
        .click({ timeout: 15000 })
        .catch(async () => {
          await confirmBtn.click({ force: true });
        });
    });

    await test.step("Save and assert success toast", async () => {
      await popup.getByRole("button", { name: /Save/i }).click();
      await expect(popup.getByText("Update Success")).toBeVisible({
        timeout: 20000,
      });
    });
  });
});
