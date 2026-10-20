import { test, expect } from "../helpers/softTest.js";
import { devices } from "@playwright/test";
import {
  emulateMobileStorefront,
  gotoOneDirectBuy,
  openFirstProductFromShop,
  openMobileNav,
  waitForShopProducts,
} from "../helpers/oneDirectBuyNav.js";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Responsive UI (mobile 390×844)", () => {
  test.use({
    viewport: MOBILE,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: devices["iPhone 13"].userAgent,
  });

  test.beforeEach(async ({ page }) => {
    await emulateMobileStorefront(page, MOBILE);
  });

  test("ODB-UC-491: homepage works on mobile", async ({ page, soft }) => {
    await soft("ODB-UC-491", "Welcome + mobile bottom bar", async () => {
      await gotoOneDirectBuy(page, "/");
      await emulateMobileStorefront(page, MOBILE);
      const home = page.getByRole("link", { name: /OneDirectBuy home/i });
      const cart = page.getByRole("link", { name: /Shopping cart/i });
      await expect(home.last()).toBeVisible({ timeout: 30_000 });
      let cartVisible = false;
      const cartCount = await cart.count();
      for (let i = 0; i < cartCount; i++) {
        if (await cart.nth(i).isVisible().catch(() => false)) {
          cartVisible = true;
          break;
        }
      }
      expect(cartVisible).toBeTruthy();
    });
  });

  test("ODB-UC-491b: mobile Menu drawer opens Shop link", async ({ page, soft }) => {
    await soft("ODB-UC-491b", "Menu → Home / All products / Vendor / Blogs", async () => {
      await gotoOneDirectBuy(page, "/");
      await openMobileNav(page);
      await expect(page.getByRole("link", { name: /OneDirectBuy home/i }).last()).toBeVisible();
      await expect(page.locator('a[href="/shop"]').first()).toBeAttached();
    });
  });

  test("ODB-UC-492: product page works on mobile", async ({ page, soft }) => {
    await soft("ODB-UC-492", "PDP H1 visible on mobile viewport", async () => {
      await openFirstProductFromShop(page);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
        timeout: 30_000,
      });
      await emulateMobileStorefront(page, MOBILE);
      const cart = page.getByRole("link", { name: /Shopping cart/i });
      let cartVisible = false;
      const cartCount = await cart.count();
      for (let i = 0; i < cartCount; i++) {
        if (await cart.nth(i).isVisible().catch(() => false)) {
          cartVisible = true;
          break;
        }
      }
      expect(cartVisible).toBeTruthy();
    });
  });
});

test.describe("OneDirectBuy — Desktop chrome & accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-495: core buyer shop listing works in Chromium", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-495", "Shop Products found + product links", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
      await expect(page.getByText(/\d+\s+Products found/i)).toBeVisible();
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
    });
  });

  test("ODB-UC-499: keyboard navigation reaches interactive controls", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-499", "Tab focuses a visible control on homepage", async () => {
      await gotoOneDirectBuy(page, "/");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toBeVisible({ timeout: 10_000 });
    });
  });

  test("ODB-UC-501: product images have alt text on shop page", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-501", "First shop product image has alt attribute", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
      const img = page.locator('a[href*="/product/"] img').first();
      await expect(img).toBeVisible({ timeout: 30_000 });
      const alt = await img.getAttribute("alt");
      expect(alt).not.toBeNull();
      expect(String(alt).length).toBeGreaterThan(0);
    });
  });

  test("ODB-UC-502: login form fields have accessible labels", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-502", "Email address + Password + Sign in labeled", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      await expect(
        page.getByRole("heading", { name: /^Welcome back$/i }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByRole("textbox", { name: /^Email address$/i }),
      ).toBeVisible();
      await expect(page.getByRole("textbox", { name: /^Password$/i })).toBeVisible();
      await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
      await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible();
    });
  });

  test("ODB-UC-503: login validation errors are readable", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-503", "Empty Sign in shows Please input messages", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      await page.getByRole("button", { name: /^Sign in$/i }).click();
      await expect(page.getByText(/Please input your email!/i)).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(/Please input your password!/i)).toBeVisible();
    });
  });
});
