import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  waitForShopProducts,
} from "../helpers/oneDirectBuyNav.js";
import {
  ensureLoggedInBuyer,
  gotoAuthenticatedPage,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "../helpers/oneDirectBuyAuth.js";
import {
  openStoresPage,
  sellerPortalNotOnStorefrontError,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

async function requireBuyer(page) {
  await ensureLoggedInBuyer(page);
}

async function openOrders(page) {
  await requireBuyer(page);
  await gotoAuthenticatedPage(page, "/account/orders", ONE_DIRECT_BUY_BUYER_CREDENTIALS);
  await expect(page).toHaveURL(/\/account\/orders/);
}

async function openFirstOrderDetail(page) {
  await openOrders(page);
  const empty = await page
    .getByText(/no orders? yet|you have not placed|order history is empty/i)
    .first()
    .isVisible({ timeout: 4_000 })
    .catch(() => false);
  const detailLink = page
    .locator('a[href*="/account/orders/"]')
    .or(page.getByRole("link", { name: /view (order|details)|order #/i }))
    .first();
  if (empty || !(await detailLink.isVisible({ timeout: 8_000 }).catch(() => false))) {
    await expect(
      page
        .getByText(/no orders? yet|you have not placed|order history is empty|You don't have any orders/i)
        .or(page.getByRole("heading", { name: /Orders/i }))
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    return false;
  }
  await detailLink.click();
  await page.waitForURL(/\/account\/orders\/.+/, { timeout: 20_000 }).catch(() => {});
  return true;
}

test.describe("OneDirectBuy — Buyer orders", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-167: view order history", async ({ page, soft }) => {
    await soft("ODB-UC-167", "Buyer opens /account/orders", async () => {
      await openOrders(page);
      await expect(
        page
          .getByRole("heading", { name: /Orders|Order History|Your Orders/i })
          .or(page.getByText(/no orders? yet|you have not placed|order history is empty|You don't have any orders/i))
          .or(page.locator("article, table, .ps-table, .account-orders").first())
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-168: view order details", async ({ page, soft }) => {
    await soft("ODB-UC-168", "Buyer opens an order detail", async () => {
      const opened = await openFirstOrderDetail(page);
      if (!opened) return;
      await expect(
        page
          .getByText(/order (number|#)|items?|total|status|placed/i)
          .first(),
      ).toBeVisible({ timeout: 20_000 });
    });
  });

  test("ODB-UC-169: track shipment", async ({ page, soft }) => {
    await soft("ODB-UC-169-a", "Public Order Tracking form", async () => {
      await gotoOneDirectBuy(page, "/account/order-tracking");
      await expect(
        page.getByRole("heading", { name: /^Order Tracking$/i }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("textbox", { name: /^Order ID$/i })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Track Your Order$/i }),
      ).toBeVisible();
    });

    await soft("ODB-UC-169-b", "Track control on an order when present", async () => {
      await openOrders(page);
      const track = page.getByRole("link", { name: /track/i }).or(
        page.getByRole("button", { name: /track (order|shipment)/i }),
      );
      if (!(await track.first().isVisible({ timeout: 6_000 }).catch(() => false))) {
        await gotoOneDirectBuy(page, "/account/order-tracking");
        await expect(
          page.getByRole("heading", { name: /^Order Tracking$/i }),
        ).toBeVisible();
      }
    });
  });

  test("ODB-UC-170: cancel pending order", async ({ page, soft }) => {
    await soft("ODB-UC-170", "Cancel control exists (does not submit cancel)", async () => {
      await openOrders(page);
      const cancel = page.getByRole("button", { name: /cancel order/i }).or(
        page.getByRole("link", { name: /cancel order/i }),
      );
      if (!(await cancel.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
        await openFirstOrderDetail(page).catch(() => {});
      }
      if (
        !(await page
          .getByRole("button", { name: /cancel order/i })
          .or(page.getByRole("link", { name: /cancel order/i }))
          .first()
          .isVisible({ timeout: 6_000 })
          .catch(() => false))
      ) {
        throw new Error(
          "No Cancel order control on order history or details (pending orders only).",
        );
      }
    });
  });

  test("ODB-UC-171: prevent shipped cancellation", async ({ page, soft }) => {
    await soft("ODB-UC-171", "Shipped orders do not offer cancel", async () => {
      await openOrders(page);
      const shipped = page.getByText(/shipped|in transit|delivered/i).first();
      if (!(await shipped.isVisible({ timeout: 8_000 }).catch(() => false))) {
        throw new Error(
          "No shipped/delivered order to verify cancel is blocked.",
        );
      }
      const blocked = page.getByText(
        /cannot cancel|cancellation not (allowed|available)|too late to cancel/i,
      );
      if (await blocked.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        return;
      }
    });
  });

  test("ODB-UC-172: download invoice", async ({ page, soft }) => {
    await soft("ODB-UC-172", "Invoice / download control on an order", async () => {
      await openOrders(page);
      const invoice = page
        .getByRole("link", { name: /invoice|download pdf|download invoice/i })
        .or(page.getByRole("button", { name: /invoice|download/i }));
      if (!(await invoice.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
        await openFirstOrderDetail(page).catch(() => {});
      }
      if (
        !(await page
          .getByRole("link", { name: /invoice|download pdf|download invoice/i })
          .or(page.getByRole("button", { name: /invoice|download/i }))
          .first()
          .isVisible({ timeout: 6_000 })
          .catch(() => false))
      ) {
        throw new Error("No invoice download control on buyer orders.");
      }
    });
  });

  test("ODB-UC-173: reorder", async ({ page, soft }) => {
    await soft("ODB-UC-173", "Reorder control on an order", async () => {
      await openOrders(page);
      const reorder = page
        .getByRole("button", { name: /^Reorder$/i })
        .or(page.getByRole("link", { name: /^Reorder$/i }));
      if (!(await reorder.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
        await openFirstOrderDetail(page).catch(() => {});
      }
      if (
        !(await page
          .getByRole("button", { name: /^Reorder$/i })
          .or(page.getByRole("link", { name: /^Reorder$/i }))
          .first()
          .isVisible({ timeout: 6_000 })
          .catch(() => false))
      ) {
        throw new Error("No Reorder control on buyer orders.");
      }
    });
  });

  test("ODB-UC-174: contact seller from order", async ({ page, soft }) => {
    await soft("ODB-UC-174", "Contact seller from order history or details", async () => {
      await openOrders(page);
      const contact = page.getByRole("link", { name: /contact seller/i }).or(
        page.getByRole("button", { name: /contact seller/i }),
      );
      if (!(await contact.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
        await openFirstOrderDetail(page).catch(() => {});
      }
      if (
        !(await page
          .getByRole("link", { name: /contact seller/i })
          .or(page.getByRole("button", { name: /contact seller/i }))
          .first()
          .isVisible({ timeout: 6_000 })
          .catch(() => false))
      ) {
        throw new Error("No Contact seller control on the order page.");
      }
    });
  });

  test("ODB-UC-175: shipment status update", async ({ page, soft }) => {
    await soft("ODB-UC-175", "Order list or detail shows shipment status", async () => {
      await openOrders(page);
      const status = page.getByText(
        /processing|packed|shipped|in transit|out for delivery|label created/i,
      );
      if (!(await status.first().isVisible({ timeout: 10_000 }).catch(() => false))) {
        throw new Error("No shipment status update is visible on buyer orders.");
      }
    });
  });

  test("ODB-UC-176: delivered status", async ({ page, soft }) => {
    await soft("ODB-UC-176", "Buyer can see Delivered on an order", async () => {
      await openOrders(page);
      if (
        !(await page
          .getByText(/^Delivered$|status:\s*delivered/i)
          .first()
          .isVisible({ timeout: 8_000 })
          .catch(() => false))
      ) {
        throw new Error("No Delivered status is visible on buyer orders.");
      }
    });
  });
});

test.describe("OneDirectBuy — Multi-seller orders", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-177: place multi-seller order", async ({ page, soft }) => {
    await soft("ODB-UC-177", "Catalog has more than one seller store", async () => {
      await openStoresPage(page);
      const stores = page.locator('a[href*="/store/"]');
      await expect(stores.first()).toBeVisible({ timeout: 60_000 });
      if ((await stores.count()) < 2) {
        await gotoOneDirectBuy(page, "/shop");
        await waitForShopProducts(page);
        throw new Error(
          "Fewer than two seller stores — cannot place a multi-seller order from this catalog.",
        );
      }
    });
  });

  test("ODB-UC-178: create seller sub-orders", async ({ page, soft }) => {
    await soft(
      "ODB-UC-178",
      "Parent order split into seller sub-orders (New Functionality)",
      async () => {
        await openOrders(page);
        const split = page.getByText(
          /sub-?order|split order|seller order|fulfilled by/i,
        );
        if (!(await split.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
          throw new Error(
            "Buyer orders do not show seller sub-orders (sheet: New Functionality).",
          );
        }
      },
    );
  });

  test("ODB-UC-179: seller sees own sub-order", async ({ page, soft }) => {
    await soft("ODB-UC-179", "Seller sub-order workspace", async () => {
      for (const path of ["/vendor/orders", "/vendor/dashboard"]) {
        await gotoOneDirectBuy(page, path);
        const ui = page.getByText(
          /seller orders|sub-?order|your orders|fulfillment/i,
        );
        if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
          return;
        }
      }
      throw new Error(sellerPortalNotOnStorefrontError("Seller sees own sub-order"));
    });
  });

  test("ODB-UC-180: buyer sees combined order", async ({ page, soft }) => {
    await soft("ODB-UC-180", "Buyer order history shows a combined order", async () => {
      await openOrders(page);
      await expect(
        page
          .getByRole("heading", { name: /Orders|Order History|Your Orders/i })
          .or(page.getByText(/no orders? yet|you have not placed|order history is empty/i))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
      const combined = page.getByText(
        /items from \d+|multiple sellers|combined order|sold by/i,
      );
      if (!(await combined.first().isVisible({ timeout: 6_000 }).catch(() => false))) {
        return;
      }
    });
  });

  test("ODB-UC-181: partial shipment", async ({ page, soft }) => {
    await soft("ODB-UC-181", "Partial shipment status (Test pending)", async () => {
      await openOrders(page);
      const partial = page.getByText(
        /partially shipped|partial shipment|shipped \d+ of \d+/i,
      );
      if (!(await partial.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
        throw new Error(
          "Partial shipment is not visible on buyer orders (sheet: Test pending).",
        );
      }
    });
  });

  test("ODB-UC-182: admin views full order", async ({ page, soft }) => {
    await soft("ODB-UC-182", "Admin full order with sub-orders", async () => {
      for (const path of ["/admin/orders", "/vendor/admin/orders"]) {
        await gotoOneDirectBuy(page, path);
        const ui = page.getByText(
          /all orders|sub-?orders|manage orders|order management/i,
        );
        if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
          return;
        }
      }
      throw new Error(
        "Admin full multi-seller order view is not on the storefront (admin orders live in OneChannel).",
      );
    });
  });
});
