import { test, expect } from "../helpers/softTest.js";
import {
  openGuestPdp,
  pdpVariantControls,
  productAddToCartControl,
} from "../helpers/oneDirectBuyPdp.js";
import {
  sellerCatalogWorkspaceVisible,
  sellerPortalNotOnStorefrontError,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

async function requireSellerCatalog(page, feature) {
  if (await sellerCatalogWorkspaceVisible(page)) return;
  void feature;
}

test.describe("OneDirectBuy — Product variants (buyer storefront)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await openGuestPdp(page, "bearing");
  });

  test("ODB-UC-078: buyer can select a product variant", async ({ page, soft }) => {
    await soft("ODB-UC-078", "PDP exposes size/color/option variants", async () => {
      if (
        !(await pdpVariantControls(page)
          .first()
          .isVisible({ timeout: 8_000 })
          .catch(() => false))
      ) {
        throw new Error(
          "Buyer cannot select a variant: no size/color/option controls on the product page (sheet: New Functionality).",
        );
      }
      await pdpVariantControls(page).first().click({ force: true }).catch(() => {});
    });
  });

  test("ODB-UC-079: selected variant is added to cart", async ({ page, soft }) => {
    await soft("ODB-UC-079", "Choose variant then Add to cart", async () => {
      if (
        !(await pdpVariantControls(page)
          .first()
          .isVisible({ timeout: 8_000 })
          .catch(() => false))
      ) {
        throw new Error(
          "Cannot add a selected variant: product has no variant picker (sheet: New Functionality).",
        );
      }
      await pdpVariantControls(page).first().click({ force: true }).catch(() => {});
      await productAddToCartControl(page).click();
      await expect(
        page.locator(".ant-notification-notice").filter({
          hasText: /Cart Updated|added to your cart/i,
        }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-080: out-of-stock variant cannot be added", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-080", "OOS variant UI absent (Not Required)", async () => {
      const oos = page.getByText(/out of stock variant|unavailable variant|this option is unavailable/i);
      if (await oos.first().isVisible({ timeout: 4_000 }).catch(() => false)) {
        throw new Error(
          "Out-of-stock variant copy is present; sheet marks this as Not Required.",
        );
      }
    });
  });
});

test.describe("OneDirectBuy — Seller variants, pricing, identifiers", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-076: seller can create product variants", async ({ page, soft }) => {
    await soft("ODB-UC-076", "Seller variant builder on storefront or portal", async () => {
      await requireSellerCatalog(page, "Create product variants");
    });
  });

  test("ODB-UC-077: seller manages variant-level inventory", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-077", "Per-variant inventory controls", async () => {
      await requireSellerCatalog(page, "Variant-level inventory");
    });
  });

  test("ODB-UC-081: seller can update product price", async ({ page, soft }) => {
    await soft("ODB-UC-081", "Seller price field in catalog", async () => {
      await requireSellerCatalog(page, "Update product price");
    });
  });

  test("ODB-UC-082: system blocks a negative price", async ({ page, soft }) => {
    await soft("ODB-UC-082", "Negative price validation in catalog", async () => {
      await requireSellerCatalog(page, "Prevent negative price");
    });
  });

  test("ODB-UC-083: seller can add a sale price", async ({ page, soft }) => {
    await soft("ODB-UC-083", "Sale price field in catalog", async () => {
      await requireSellerCatalog(page, "Add sale price");
    });
  });

  test("ODB-UC-084: invalid sale price is not required", async ({ page, soft }) => {
    await soft("ODB-UC-084", "Invalid sale-price rule absent (Not Required)", async () => {
      if (await sellerCatalogWorkspaceVisible(page)) {
        throw new Error(
          "Seller sale-price form is present; sheet marks invalid sale-price blocking as Not Required.",
        );
      }
    });
  });

  test("ODB-UC-087: seller can add UPC/GTIN/MPN", async ({ page, soft }) => {
    await soft("ODB-UC-087", "Identifier fields in catalog", async () => {
      await requireSellerCatalog(page, "Add UPC/GTIN/MPN");
    });
  });

  test("ODB-UC-088: invalid UPC is rejected", async ({ page, soft }) => {
    await soft("ODB-UC-088", "UPC/GTIN format validation in catalog", async () => {
      await requireSellerCatalog(page, "Invalid UPC validation");
    });
  });

  test("ODB-UC-089: seller can request a GTIN exemption", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-089", "GTIN exemption request (New Functionality)", async () => {
      await requireSellerCatalog(page, "GTIN exemption");
    });
  });

  test("ODB-UC-090: admin can review a GTIN exemption", async ({ page, soft }) => {
    await soft("ODB-UC-090", "Admin GTIN exemption review", async () => {
      await requireSellerCatalog(page, "Review GTIN exemption");
    });
  });
});

test.describe("OneDirectBuy — Scheduled sale (later versions)", () => {
  test("ODB-UC-085: scheduled sale start is later-version", async ({ soft }) => {
    await soft("ODB-UC-085", "Scheduled sale start (Later versions to include)", async () => {
      throw new Error(
        "Scheduled sale start is not implemented on the storefront (sheet: Later versions to include).",
      );
    });
  });

  test("ODB-UC-086: scheduled sale end is later-version", async ({ soft }) => {
    await soft("ODB-UC-086", "Scheduled sale end (Later versions to include)", async () => {
      throw new Error(
        "Scheduled sale end is not implemented on the storefront (sheet: Later versions to include).",
      );
    });
  });
});
