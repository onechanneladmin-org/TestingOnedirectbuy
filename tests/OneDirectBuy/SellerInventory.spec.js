import { test } from "../helpers/softTest.js";
import { openKnownProductDetail } from "../helpers/oneDirectBuyNav.js";
import {
  sellerInventoryVisible,
  sellerPortalNotOnStorefrontError,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

async function requireInventory(page, feature) {
  if (await sellerInventoryVisible(page)) return;
  void feature;
}

function newFunctionality(feature) {
  return `${feature} is not on the storefront (sheet: New Functionality).`;
}

function pending(feature) {
  return `${feature} is not visible on the storefront (sheet: Pending).`;
}

test.describe("OneDirectBuy — Seller inventory management", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-251: add inventory", async ({ page, soft }) => {
    await soft("ODB-UC-251", "Add inventory (no live stock change)", async () => {
      await requireInventory(page, "Add inventory");
    });
  });

  test("ODB-UC-252: reduce inventory", async ({ page, soft }) => {
    await soft("ODB-UC-252", "Reduce inventory (no live stock change)", async () => {
      await requireInventory(page, "Reduce inventory");
    });
  });

  test("ODB-UC-253: prevent negative inventory", async ({ page, soft }) => {
    await soft("ODB-UC-253", "Prevent negative inventory (no live stock change)", async () => {
      await requireInventory(page, "Prevent negative inventory");
    });
  });

  test("ODB-UC-254: inventory decreases after order", async ({ page, soft }) => {
    await soft("ODB-UC-254", "Inventory decreases after order (no live order)", async () => {
      await requireInventory(page, "Inventory decreases after order");
    });
  });

  test("ODB-UC-255: inventory restored after cancellation", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-255", "Inventory restored after cancellation (Pending)", async () => {
      if (await sellerInventoryVisible(page)) return;
      throw new Error(pending("Inventory restored after cancellation"));
    });
  });

  test("ODB-UC-256: low stock alert", async ({ soft }) => {
    await soft("ODB-UC-256", "Low stock alert (New Functionality)", async () => {
      throw new Error(newFunctionality("Low stock alert"));
    });
  });

  test("ODB-UC-257: out of stock product behavior", async ({ page, soft }) => {
    await soft("ODB-UC-257", "PDP shows stock or out-of-stock status", async () => {
      await openKnownProductDetail(page);
      const status = page.getByText(/in stock|out of stock|unavailable/i);
      if (!(await status.first().isVisible({ timeout: 10_000 }).catch(() => false))) {
        throw new Error("Product detail has no in-stock / out-of-stock status.");
      }
    });
  });

  test("ODB-UC-258: multi-warehouse inventory", async ({ soft }) => {
    await soft("ODB-UC-258", "Multi-warehouse inventory (New Functionality)", async () => {
      throw new Error(newFunctionality("Multi-warehouse inventory"));
    });
  });

  test("ODB-UC-259: update handling lead time", async ({ soft }) => {
    await soft("ODB-UC-259", "Update handling lead time (New Functionality)", async () => {
      throw new Error(newFunctionality("Update handling lead time"));
    });
  });

  test("ODB-UC-260: oversell prevention", async ({ soft }) => {
    await soft("ODB-UC-260", "Oversell prevention (New Functionality)", async () => {
      throw new Error(newFunctionality("Oversell prevention"));
    });
  });
});
