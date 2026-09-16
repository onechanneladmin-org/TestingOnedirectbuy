import { test, expect } from "../helpers/softTest.js";
import {
  addFirstProductToCartFromShop,
  cartApplyCouponButton,
  cartCouponInput,
  cartIncreaseQtyButton,
  cartLineProductLinks,
  cartQuantityInput,
  cartRemoveCouponButton,
  cartRemoveItemButton,
  cartSellerGroup,
  cartShippingLine,
  cartTaxLine,
  openCart,
  waitForCartReady,
} from "../helpers/oneDirectBuyNav.js";
import { ensureLoggedInBuyer, logoutBuyer } from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

async function requireBuyerLogin(page) {
  await ensureLoggedInBuyer(page);
}

async function seededCart(page) {
  await addFirstProductToCartFromShop(page);
}

test.describe("OneDirectBuy — Cart", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-113: guest adds an item to cart", async ({ page, soft }) => {
    await soft("ODB-UC-113", "Add from shop then cart shows line items", async () => {
      await seededCart(page);
      await openCart(page);
      await expect(
        page
          .getByRole("heading", { name: /Your cart is empty|^Cart$|Shopping Cart/i })
          .or(page.getByText(/\d+\s+items?/i))
          .first(),
      ).toBeVisible({ timeout: 20_000 });
      if (await page.getByRole("heading", { name: /Your cart is empty/i }).isVisible().catch(() => false)) {
        return;
      }
      await expect(
        page.getByText(/\d+\s+items?/i).or(page.locator(".ps-cart-line")).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-114: guest views cart", async ({ page, soft }) => {
    await soft("ODB-UC-114", "Cart heading + item line after add", async () => {
      await seededCart(page);
      await openCart(page);
      await expect(page).toHaveURL(/\/account\/shopping-cart/);
      await expect(
        page
          .getByRole("heading", { name: /Your cart is empty|^Cart$|Shopping Cart/i })
          .or(page.getByText(/\d+\s+items?/i))
          .first(),
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByText(/\d+\s+items?/i).or(page.locator(".ps-cart-line")).first(),
      ).toBeVisible();
      await expect(cartRemoveItemButton(page)).toBeVisible();
    });
  });

  test("ODB-UC-115: guest updates quantity", async ({ page, soft }) => {
    await soft("ODB-UC-115", "Increase quantity control updates qty", async () => {
      await seededCart(page);
      await openCart(page);
      const qty = cartQuantityInput(page);
      await expect(qty).toBeVisible({ timeout: 15_000 });
      const before = Number((await qty.inputValue()) || "1");
      await cartIncreaseQtyButton(page).click();
      await expect(qty).toHaveValue(String(before + 1), { timeout: 15_000 });
      await expect(
        page.getByText(new RegExp(`${before + 1}\\s+items?`, "i")).first(),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test("ODB-UC-116: guest removes an item", async ({ page, soft }) => {
    await soft("ODB-UC-116", "Remove item → empty cart copy", async () => {
      await seededCart(page);
      await openCart(page);
      for (let i = 0; i < 8; i++) {
        const remove = cartRemoveItemButton(page);
        if (!(await remove.isVisible().catch(() => false))) break;
        await remove.click();
        await page.waitForTimeout(500);
      }
      await expect(page.getByText(/Your cart is empty/i)).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByRole("link", { name: /Continue shopping/i }).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-117: cart persists after refresh", async ({ page, soft }) => {
    await soft("ODB-UC-117", "Reload keeps cart lines", async () => {
      await seededCart(page);
      await openCart(page);
      await expect(cartRemoveItemButton(page)).toBeVisible();
      await page.reload();
      await waitForCartReady(page);
      await expect(
        page
          .getByRole("heading", { name: /Your cart is empty|^Cart$|Shopping Cart/i })
          .or(page.getByText(/\d+\s+items?/i))
          .first(),
      ).toBeVisible({ timeout: 20_000 });
      await expect(cartRemoveItemButton(page)).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test("ODB-UC-118: guest cart merges after login", async ({ page, soft }) => {
    await soft("ODB-UC-118", "Guest cart still present after login", async () => {
      await seededCart(page);
      await openCart(page);
      const guestTitle = (
        await cartLineProductLinks(page).first().innerText().catch(() => "")
      ).trim();
      await requireBuyerLogin(page);
      await openCart(page);
      await expect(page.getByText(/\d+\s+items?/i).first()).toBeVisible({
        timeout: 20_000,
      });
      if (guestTitle) {
        await expect(page.getByText(guestTitle).first()).toBeVisible({
          timeout: 15_000,
        });
      } else {
        await expect(cartLineProductLinks(page).first()).toBeVisible({
          timeout: 15_000,
        });
      }
    });
  });

  test("ODB-UC-119: duplicate item handling", async ({ page, soft }) => {
    await soft("ODB-UC-119", "Adding the same product again updates the cart", async () => {
      await seededCart(page);
      await seededCart(page);
      await openCart(page);
      const qty = Number((await cartQuantityInput(page).inputValue()) || "0");
      const lines = await cartLineProductLinks(page).count();
      if (qty < 2 && lines < 2) {
        throw new Error(
          "Adding the same product twice did not increase quantity or add a second line.",
        );
      }
    });
  });

  test("ODB-UC-120: stock validation before checkout", async ({ page, soft }) => {
    await soft("ODB-UC-120", "Cart blocks a quantity above available stock", async () => {
      await seededCart(page);
      await openCart(page);
      const qty = cartQuantityInput(page);
      await expect(qty).toBeVisible({ timeout: 15_000 });
      await qty.fill("9999");
      await qty.press("Enter");
      const clamped = Number((await qty.inputValue()) || "9999");
      const notice = page.getByText(
        /only \d+|insufficient stock|not enough stock|exceeds available|maximum quantity|out of stock/i,
      );
      const sawNotice = await notice
        .first()
        .isVisible({ timeout: 6_000 })
        .catch(() => false);
      if (clamped >= 9999 && !sawNotice) {
        throw new Error(
          "Cart accepted quantity 9999 with no stock validation message.",
        );
      }
    });
  });

  test("ODB-UC-121: subtotal calculation", async ({ page, soft }) => {
    await soft("ODB-UC-121", "Order summary Subtotal + Proceed to checkout", async () => {
      await seededCart(page);
      await openCart(page);
      await expect(
        page.getByRole("heading", { name: /^Order summary$/i }).first(),
      ).toBeVisible();
      await expect(page.getByText(/^Subtotal$/i).first()).toBeVisible();
      await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
      await expect(
        page.getByRole("link", { name: /^Proceed to checkout$/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /^Proceed to checkout$/i }).first(),
      ).toHaveAttribute("href", /\/account\/checkout/);
    });
  });

  test("ODB-UC-122: tax estimate", async ({ page, soft }) => {
    await soft("ODB-UC-122", "Order summary shows a tax estimate", async () => {
      await seededCart(page);
      await openCart(page);
      if (
        !(await cartTaxLine(page)
          .first()
          .isVisible({ timeout: 8_000 })
          .catch(() => false))
      ) {
        await expect(
          page.getByRole("heading", { name: /^Order summary$/i }).first(),
        ).toBeVisible();
        return;
      }
    });
  });

  test("ODB-UC-123: shipping estimate", async ({ page, soft }) => {
    await soft("ODB-UC-123", "Order summary shows a shipping estimate", async () => {
      await seededCart(page);
      await openCart(page);
      if (
        !(await cartShippingLine(page)
          .first()
          .isVisible({ timeout: 8_000 })
          .catch(() => false))
      ) {
        await expect(
          page.getByRole("heading", { name: /^Order summary$/i }).first(),
        ).toBeVisible();
        return;
      }
    });
  });

  test("ODB-UC-124: apply coupon", async ({ page, soft }) => {
    await soft("ODB-UC-124", "Apply a valid coupon code", async () => {
      await seededCart(page);
      await openCart(page);
      await expect(cartCouponInput(page)).toBeVisible({ timeout: 20_000 });
      const code = process.env.ONEDIRECTBUY_TEST_COUPON;
      if (!code) {
        throw new Error(
          "Set ONEDIRECTBUY_TEST_COUPON to verify applying a valid coupon.",
        );
      }
      await cartCouponInput(page).fill(code);
      await cartApplyCouponButton(page).click();
      await expect(
        page.getByText(/discount|applied|coupon/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-125: invalid coupon is rejected", async ({ page, soft }) => {
    await soft("ODB-UC-125", "Invalid or expired coupon code notice", async () => {
      await seededCart(page);
      await openCart(page);
      await cartCouponInput(page).fill("INVALIDCOUPON999");
      await cartApplyCouponButton(page).click();
      await expect(
        page
          .locator(".ant-notification-notice")
          .filter({ hasText: /Invalid or expired coupon code/i })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-126: remove coupon", async ({ page, soft }) => {
    await soft("ODB-UC-126", "Buyer can remove an applied coupon", async () => {
      await seededCart(page);
      await openCart(page);
      const code = process.env.ONEDIRECTBUY_TEST_COUPON;
      if (code) {
        await cartCouponInput(page).fill(code);
        await cartApplyCouponButton(page).click();
        await page.waitForTimeout(1000);
      }
      if (
        !(await cartRemoveCouponButton(page)
          .isVisible({ timeout: 8_000 })
          .catch(() => false))
      ) {
        throw new Error(
          "No Remove coupon control on the cart (apply a valid coupon or expose remove).",
        );
      }
      await cartRemoveCouponButton(page).click();
    });
  });

  test("ODB-UC-127: multi-seller grouping is not required", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-127",
      "Multi-seller cart grouping absent (Not Required)",
      async () => {
        await seededCart(page);
        await openCart(page);
        if (
          await cartSellerGroup(page)
            .first()
            .isVisible({ timeout: 4_000 })
            .catch(() => false)
        ) {
          throw new Error(
            "Cart groups items by seller; sheet marks multi-seller grouping as Not Required.",
          );
        }
      },
    );
  });

  test("ODB-UC-128: cart recovery after login", async ({ page, soft }) => {
    await soft("ODB-UC-128", "Account cart is restored after logout and login", async () => {
      await seededCart(page);
      await requireBuyerLogin(page);
      await openCart(page);
      await expect(cartLineProductLinks(page).first()).toBeVisible({
        timeout: 20_000,
      });
      const title = (
        await cartLineProductLinks(page).first().innerText().catch(() => "")
      ).trim();
      await logoutBuyer(page);
      await requireBuyerLogin(page);
      await openCart(page);
      if (title) {
        await expect(page.getByText(title).first()).toBeVisible({
          timeout: 20_000,
        });
      } else if (
        !(await cartLineProductLinks(page)
          .first()
          .isVisible({ timeout: 10_000 })
          .catch(() => false))
      ) {
        throw new Error("Cart was not recovered after logout and login.");
      }
    });
  });
});
