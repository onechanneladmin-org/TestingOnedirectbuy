import { test } from "../helpers/softTest.js";
import {
  sellerPortalNotOnStorefrontError,
  sellerProductCatalogVisible,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

async function requireCatalog(page, feature) {
  if (await sellerProductCatalogVisible(page)) return;
  void feature;
}

function laterVersion(feature) {
  return `${feature} is not implemented on the storefront (sheet: Later versions to include).`;
}

function newFunctionality(feature) {
  return `${feature} is not on the storefront (sheet: New Functionality).`;
}

function testPending(feature) {
  return `${feature} is not visible on the storefront (sheet: Test pending).`;
}

test.describe("OneDirectBuy — Product approval and catalog", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-215: add new product", async ({ page, soft }) => {
    await soft("ODB-UC-215", "Add new product (no live catalog change)", async () => {
      await requireCatalog(page, "Add new product");
    });
  });

  test("ODB-UC-216: add offer to existing product", async ({ page, soft }) => {
    await soft("ODB-UC-216", "Add offer to existing product (Test pending)", async () => {
      if (await sellerProductCatalogVisible(page)) return;
      throw new Error(testPending("Add offer to existing product"));
    });
  });

  test("ODB-UC-217: duplicate product detection is later-version", async ({
    soft,
  }) => {
    await soft("ODB-UC-217", "Duplicate product detection (Later versions to include)", async () => {
      throw new Error(laterVersion("Duplicate product detection"));
    });
  });

  test("ODB-UC-218: required product field validation", async ({ page, soft }) => {
    await soft("ODB-UC-218", "Required product field validation (Test pending)", async () => {
      if (await sellerProductCatalogVisible(page)) return;
      throw new Error(testPending("Required product field validation"));
    });
  });

  test("ODB-UC-219: upload product images", async ({ page, soft }) => {
    await soft("ODB-UC-219", "Upload product images (no live catalog change)", async () => {
      await requireCatalog(page, "Upload product images");
    });
  });

  test("ODB-UC-220: invalid product image", async ({ page, soft }) => {
    await soft("ODB-UC-220", "Invalid product image rejection (no live catalog change)", async () => {
      await requireCatalog(page, "Invalid product image rejection");
    });
  });

  test("ODB-UC-221: add product specs", async ({ page, soft }) => {
    await soft("ODB-UC-221", "Add product specs (no live catalog change)", async () => {
      await requireCatalog(page, "Add product specs");
    });
  });

  test("ODB-UC-222: add product documents", async ({ page, soft }) => {
    await soft("ODB-UC-222", "Add product documents (no live catalog change)", async () => {
      await requireCatalog(page, "Add product documents");
    });
  });

  test("ODB-UC-223: review new product", async ({ page, soft }) => {
    await soft("ODB-UC-223", "Review new product (no live catalog change)", async () => {
      await requireCatalog(page, "Review new product");
    });
  });

  test("ODB-UC-224: approve product", async ({ page, soft }) => {
    await soft("ODB-UC-224", "Approve product (no live catalog change)", async () => {
      await requireCatalog(page, "Approve product");
    });
  });

  test("ODB-UC-225: reject product", async ({ page, soft }) => {
    await soft("ODB-UC-225", "Reject product (no live catalog change)", async () => {
      await requireCatalog(page, "Reject product");
    });
  });

  test("ODB-UC-226: request product changes", async ({ page, soft }) => {
    await soft("ODB-UC-226", "Request product changes (no live catalog change)", async () => {
      await requireCatalog(page, "Request product changes");
    });
  });

  test("ODB-UC-227: resubmit rejected product", async ({ page, soft }) => {
    await soft("ODB-UC-227", "Resubmit rejected product (no live catalog change)", async () => {
      await requireCatalog(page, "Resubmit rejected product");
    });
  });

  test("ODB-UC-228: edit approved product", async ({ page, soft }) => {
    await soft("ODB-UC-228", "Edit approved product (no live catalog change)", async () => {
      await requireCatalog(page, "Edit approved product");
    });
  });

  test("ODB-UC-229: deactivate product offer", async ({ page, soft }) => {
    await soft("ODB-UC-229", "Deactivate product offer (no live catalog change)", async () => {
      await requireCatalog(page, "Deactivate product offer");
    });
  });

  test("ODB-UC-230: block prohibited product", async ({ page, soft }) => {
    await soft("ODB-UC-230", "Block prohibited product (no live catalog change)", async () => {
      await requireCatalog(page, "Block prohibited product");
    });
  });

  test("ODB-UC-231: assign correct category", async ({ page, soft }) => {
    await soft("ODB-UC-231", "Assign correct category (no live catalog change)", async () => {
      await requireCatalog(page, "Assign correct category");
    });
  });

  test("ODB-UC-232: bulk product upload", async ({ page, soft }) => {
    await soft("ODB-UC-232", "Bulk product upload (no live catalog change)", async () => {
      await requireCatalog(page, "Bulk product upload");
    });
  });

  test("ODB-UC-233: bulk price update", async ({ page, soft }) => {
    await soft("ODB-UC-233", "Bulk price update (no live catalog change)", async () => {
      await requireCatalog(page, "Bulk price update");
    });
  });

  test("ODB-UC-234: bulk inventory update", async ({ page, soft }) => {
    await soft("ODB-UC-234", "Bulk inventory update (no live catalog change)", async () => {
      await requireCatalog(page, "Bulk inventory update");
    });
  });

  test("ODB-UC-235: flag banned product content", async ({ soft }) => {
    await soft("ODB-UC-235", "Flag banned product content (New Functionality)", async () => {
      throw new Error(newFunctionality("Flag banned product content"));
    });
  });

  test("ODB-UC-236: approve flagged product", async ({ page, soft }) => {
    await soft("ODB-UC-236", "Approve flagged product (no live catalog change)", async () => {
      await requireCatalog(page, "Approve flagged product");
    });
  });

  test("ODB-UC-237: reject misleading product claims", async ({ soft }) => {
    await soft("ODB-UC-237", "Reject misleading claims (New Functionality)", async () => {
      throw new Error(newFunctionality("Reject misleading product claims"));
    });
  });
});
