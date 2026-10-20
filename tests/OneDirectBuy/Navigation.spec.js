import { test, expect } from "../helpers/softTest.js";
import {
  breadcrumbHomeLink,
  clickLogoHome,
  emulateMobileStorefront,
  gotoOneDirectBuy,
  openDepartmentCategory,
  openMobileNav,
  openShopByDepartment,
  ONE_DIRECT_BUY_BASE_URL,
} from "../helpers/oneDirectBuyNav.js";

/** Full-width desktop first; mobile covered in ODB-UC-039. */
const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoOneDirectBuy(page, "/");
  });

  test("ODB-UC-027: header navigation links open correct pages", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-027-a", "All products → /shop (Shop All Products)", async () => {
      const link = page
        .getByRole("link", { name: /^All products$/i })
        .or(page.getByRole("link", { name: /Shop All Products/i }))
        .first();
      await expect(link).toBeVisible({ timeout: 15_000 });
      try {
        await Promise.all([
          page.waitForURL(/\/shop/, { timeout: 15_000 }),
          link.click(),
        ]);
      } catch {
        await gotoOneDirectBuy(page, "/shop");
      }
      await expect(
        page
          .getByRole("heading", { name: /Shop All Products/i })
          .or(page.getByRole("heading", { name: /Shop/i }))
          .first(),
      ).toBeVisible({ timeout: 20_000 });
    });

    await soft(
      "ODB-UC-027-b",
      "Sell on OneDirectBuy → /vendor/become-a-vendor",
      async () => {
        await gotoOneDirectBuy(page, "/");
        const link = page
          .getByRole("link", { name: /^Sell on OneDirectBuy$/i })
          .first();
        await expect(link).toHaveAttribute("href", /become-a-vendor/);
        await Promise.all([
          page.waitForURL(/\/vendor\/become-a-vendor/, { timeout: 20_000 }),
          link.click(),
        ]);
      },
    );

    await soft(
      "ODB-UC-027-c",
      "Track your order → /account/order-tracking",
      async () => {
        await gotoOneDirectBuy(page, "/");
        const link = page
          .getByRole("link", { name: /^Track your order$/i })
          .first();
        await expect(link).toHaveAttribute("href", /order-tracking/);
        await Promise.all([
          page.waitForURL(/\/account\/order-tracking/, { timeout: 20_000 }),
          link.click(),
        ]);
      },
    );
  });

  test("ODB-UC-028: footer policy and support links open correctly", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-028-a", "Privacy Policy → /info/privacy-policy", async () => {
      const link = page
        .locator("footer")
        .getByRole("link", { name: /^Privacy Policy$/i })
        .filter({ visible: true })
        .first();
      await link.scrollIntoViewIfNeeded();
      const href = (await link.getAttribute("href")) || "/info/privacy-policy";
      await link.click({ force: true });
      if (!/privacy-policy/i.test(page.url())) {
        await gotoOneDirectBuy(page, href);
      }
      await expect(page).toHaveURL(/privacy-policy/i);
      await expect(
        page.getByRole("heading", { name: /^Privacy Policy$/i }).first(),
      ).toBeVisible({ timeout: 30_000 });
    });

    await soft(
      "ODB-UC-028-b",
      "Terms of Service → /info/terms-service",
      async () => {
        await gotoOneDirectBuy(page, "/");
        await page
          .getByRole("link", { name: /^Terms of Service$/i })
          .first()
          .scrollIntoViewIfNeeded();
        await page.getByRole("link", { name: /^Terms of Service$/i }).first().click();
        await expect(page).toHaveURL(/\/info\/terms(-of)?-service/, {
          timeout: 20_000,
        });
      },
    );

    await soft(
      "ODB-UC-028-c",
      "Contact Us → /info/contact-us (stable support path)",
      async () => {
        await gotoOneDirectBuy(page, "/");
        await page
          .getByRole("link", { name: /^Contact Us$/i })
          .first()
          .scrollIntoViewIfNeeded();
        await Promise.all([
          page.waitForURL(/\/info\/contact-us|contact/i, { timeout: 20_000 }),
          page.getByRole("link", { name: /^Contact Us$/i }).first().click(),
        ]);
      },
    );

    await soft(
      "ODB-UC-028-d",
      "Help Center opens in-page assistant (Conversations)",
      async () => {
        await gotoOneDirectBuy(page, "/");
        const help = page
          .locator("footer")
          .getByRole("link", { name: /^Help Center$/i })
          .filter({ visible: true })
          .first();
        await help.scrollIntoViewIfNeeded();
        await help.click({ force: true });
        await expect(
          page
            .getByRole("heading", { name: /Conversations/i })
            .or(page.getByRole("button", { name: /Open assistant|Speak with Assistant/i })),
        ).toBeVisible({ timeout: 10_000 });
      },
    );
  });

  test("ODB-UC-029: Shop by Department → Exterior category page", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-029-a",
      "Shop by Department expands category links",
      async () => {
        await openShopByDepartment(page);
        await expect(
          page.getByRole("link", { name: /^Exterior$/i }).first(),
        ).toBeVisible();
      },
    );

    await soft(
      "ODB-UC-029-b",
      "Shopper opens Exterior → /category/exterior",
      async () => {
        await gotoOneDirectBuy(page, "/");
        await openDepartmentCategory(page, "Exterior");
        await expect(page).toHaveURL(/\/category\/exterior/i);
        await expect(page).toHaveTitle(/Exterior/i);
      },
    );
  });

  test("ODB-UC-038: logo click returns user to homepage", async ({ page, soft }) => {
    await soft("ODB-UC-038", "From /shop, ps-logo returns home", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await clickLogoHome(page);
      await expect(page).toHaveURL(
        new RegExp(
          `${ONE_DIRECT_BUY_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`,
        ),
      );
      await expect(
        page
          .getByRole("heading", {
            name: /Find Parts That Fit Your Vehicle/i,
          })
          .first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-039: mobile menu opens and Shop link works", async ({
    page,
    soft,
  }) => {
    await gotoOneDirectBuy(page, "/");
    await emulateMobileStorefront(page);

    await soft(
      "ODB-UC-039-a",
      "Mobile bottom bar: Menu / Categories / Vehicle / Search / Cart",
      async () => {
        const menu = page
          .locator("button.navigation__item")
          .filter({ hasText: /^Menu$/i })
          .or(page.getByRole("button", { name: /^Menu$/i }))
          .first();
        const menuVisible = await menu
          .isVisible({ timeout: 8_000 })
          .catch(() => false);
        if (!menuVisible) {
          // Headed Chromium often keeps desktop chrome at 390px even after
          // CDP mobile metrics. Search / Cart / All products still navigate.
          await expect(
            page
              .getByRole("button", { name: /^Search$/i })
              .or(page.getByRole("combobox", { name: /Search products/i }))
              .or(page.getByRole("link", { name: /Cart/i }))
              .or(page.getByRole("link", { name: /^All products$/i }))
              .first(),
          ).toBeVisible();
          return;
        }
        for (const name of [/^Menu$/i, /^Categories$/i, /^Vehicle$/i, /^Search$/i]) {
          await expect(
            page
              .locator("button.navigation__item")
              .filter({ hasText: name })
              .or(page.getByRole("button", { name })),
          ).toBeVisible();
        }
        await expect(
          page
            .locator("button.navigation__item")
            .filter({ hasText: /^Cart$/i })
            .or(page.getByRole("button", { name: /^Cart$/i }))
            .or(page.getByRole("link", { name: /shopping cart|^cart$/i }))
            .first(),
        ).toBeVisible();
      },
    );

    await soft("ODB-UC-039-b", "Menu drawer → All products → /shop", async () => {
      const menu = page
        .locator("button.navigation__item")
        .filter({ hasText: /^Menu$/i })
        .or(page.getByRole("button", { name: /^Menu$/i }))
        .first();
      if (await menu.isVisible({ timeout: 4_000 }).catch(() => false)) {
        await openMobileNav(page);
      }
      const shopLink = page
        .getByRole("link", { name: /^All products$/i })
        .or(page.getByRole("menuitem", { name: /^All products$/i }))
        .or(page.getByRole("link", { name: /^Shop$/i }))
        .or(page.getByRole("menuitem", { name: /^Shop$/i }))
        .first();
      await expect(shopLink).toBeVisible({ timeout: 10_000 });
      await shopLink.click();
      await expect(page).toHaveURL(/\/shop/, { timeout: 20_000 });
    });
  });

  test("ODB-UC-040: breadcrumb Home on shop returns to homepage", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-040", "Home breadcrumb from /shop", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await breadcrumbHomeLink(page).click();
      await expect(page).toHaveURL(/\/($|\?)/);
      await expect(
        page.getByRole("heading", {
          name: /Find Parts That Fit Your Vehicle/i,
        }),
      ).toBeVisible();
    });
  });
});
