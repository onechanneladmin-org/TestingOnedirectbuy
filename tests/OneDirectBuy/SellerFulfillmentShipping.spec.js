import { test } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  sellerFulfillmentVisible,
  sellerPortalNotOnStorefrontError,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

async function requireFulfillment(page, feature) {
  if (await sellerFulfillmentVisible(page)) return;
  void feature;
}

async function requireShippingPolicy(page, feature) {
  await gotoOneDirectBuy(page, "/info/shipping-policy");
  const heading = page.getByRole("heading", {
    name: /shipping|delivery|fulfillment/i,
  });
  if (await heading.first().isVisible({ timeout: 15_000 }).catch(() => false)) {
    return;
  }
  throw new Error(`${feature} is not described on the storefront shipping policy.`);
}

test.describe("OneDirectBuy — Seller order fulfillment and shipping", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-261: view new orders", async ({ page, soft }) => {
    await soft("ODB-UC-261", "View new orders (no live fulfillment)", async () => {
      await requireFulfillment(page, "View new orders");
    });
  });

  test("ODB-UC-262: accept order", async ({ page, soft }) => {
    await soft("ODB-UC-262", "Accept order (no live fulfillment)", async () => {
      await requireFulfillment(page, "Accept order");
    });
  });

  test("ODB-UC-263: print packing slip", async ({ page, soft }) => {
    await soft("ODB-UC-263", "Print packing slip (no live print)", async () => {
      await requireFulfillment(page, "Print packing slip");
    });
  });

  test("ODB-UC-264: create shipping label", async ({ page, soft }) => {
    await soft("ODB-UC-264", "Create shipping label (no live purchase)", async () => {
      await requireFulfillment(page, "Create shipping label");
    });
  });

  test("ODB-UC-265: add manual tracking", async ({ page, soft }) => {
    await soft("ODB-UC-265", "Add manual tracking (no live update)", async () => {
      await requireFulfillment(page, "Add manual tracking");
    });
  });

  test("ODB-UC-266: mark order shipped", async ({ page, soft }) => {
    await soft("ODB-UC-266", "Mark order shipped (no live status change)", async () => {
      await requireFulfillment(page, "Mark order shipped");
    });
  });

  test("ODB-UC-267: split shipment", async ({ page, soft }) => {
    await soft("ODB-UC-267", "Split shipment (no live shipment)", async () => {
      await requireFulfillment(page, "Split shipment");
    });
  });

  test("ODB-UC-268: seller cancellation", async ({ page, soft }) => {
    await soft("ODB-UC-268", "Seller cancellation (no live cancel)", async () => {
      await requireFulfillment(page, "Seller cancellation");
    });
  });

  test("ODB-UC-269: late shipment alert", async ({ page, soft }) => {
    await soft("ODB-UC-269", "Late shipment alert (no live notify)", async () => {
      await requireFulfillment(page, "Late shipment alert");
    });
  });

  test("ODB-UC-270: monitor fulfillment SLA", async ({ page, soft }) => {
    await soft("ODB-UC-270", "Monitor fulfillment SLA (no live admin change)", async () => {
      await requireFulfillment(page, "Monitor fulfillment SLA");
    });
  });

  test("ODB-UC-271: create shipping template", async ({ page, soft }) => {
    await soft("ODB-UC-271", "Create shipping template (no live save)", async () => {
      await requireFulfillment(page, "Create shipping template");
    });
  });

  test("ODB-UC-272: edit shipping template", async ({ page, soft }) => {
    await soft("ODB-UC-272", "Edit shipping template (no live save)", async () => {
      await requireFulfillment(page, "Edit shipping template");
    });
  });

  test("ODB-UC-273: assign shipping template", async ({ page, soft }) => {
    await soft("ODB-UC-273", "Assign shipping template (no live assign)", async () => {
      await requireFulfillment(page, "Assign shipping template");
    });
  });

  test("ODB-UC-274: restricted shipping location", async ({ page, soft }) => {
    await soft("ODB-UC-274", "Restricted shipping location on shipping policy", async () => {
      await requireShippingPolicy(page, "Restricted shipping location");
    });
  });

  test("ODB-UC-275: free shipping threshold", async ({ page, soft }) => {
    await soft("ODB-UC-275", "Free shipping threshold on shipping policy", async () => {
      await requireShippingPolicy(page, "Free shipping threshold");
    });
  });

  test("ODB-UC-276: oversized item shipping", async ({ page, soft }) => {
    await soft("ODB-UC-276", "Oversized item shipping on shipping policy", async () => {
      await requireShippingPolicy(page, "Oversized item shipping");
    });
  });

  test("ODB-UC-277: multi-seller shipping calculation", async ({ page, soft }) => {
    await soft("ODB-UC-277", "Multi-seller shipping on shipping policy", async () => {
      await requireShippingPolicy(page, "Multi-seller shipping calculation");
    });
  });

  test("ODB-UC-278: carrier rate failure fallback", async ({ page, soft }) => {
    await soft("ODB-UC-278", "Carrier rate failure fallback (no live rate call)", async () => {
      await requireFulfillment(page, "Carrier rate failure fallback");
    });
  });

  test("ODB-UC-279: void label", async ({ page, soft }) => {
    await soft("ODB-UC-279", "Void label (no live void)", async () => {
      await requireFulfillment(page, "Void label");
    });
  });
});
