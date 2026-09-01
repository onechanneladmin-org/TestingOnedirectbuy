import { expect } from "@playwright/test";
import {
  gotoOneDirectBuy,
  openFirstProductFromShop,
  openKnownProductDetail,
} from "./oneDirectBuyNav.js";

/** Open the public seller onboarding landing page. */
export async function openBecomeVendorPage(page) {
  await gotoOneDirectBuy(page, "/vendor/become-a-vendor");
  await expect(
    page.getByRole("heading", { name: /^Sell on OneDirect Buy$/i }),
  ).toBeVisible({ timeout: 30_000 });
}

/** Open the marketplace store directory and wait for stores to load. */
export async function openStoresPage(page) {
  await gotoOneDirectBuy(page, "/stores");
  await expect(
    page.getByRole("heading", { name: /^Store list$/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByPlaceholder(/Search vendor/i)).toBeVisible();
  await expect(page.getByText(/^Loading\.\.\.$/i))
    .toBeHidden({ timeout: 60_000 })
    .catch(() => {});
  await expect(
    page
      .locator('a[href*="/store/"]')
      .or(page.getByRole("link", { name: /Visit Store/i }))
      .first(),
  ).toBeVisible({ timeout: 60_000 });
}

/** Click a primary Start Selling / Apply CTA → seller application. */
export async function clickStartSelling(page) {
  const startSelling = page
    .getByRole("link", { name: /^Start Selling Today$/i })
    .or(page.getByRole("link", { name: /^Apply Now$/i }))
    .or(page.getByRole("link", { name: /Start seller application/i }))
    .or(page.getByRole("link", { name: /Start Selling/i }));
  await expect(startSelling.first()).toBeVisible({ timeout: 15_000 });
  await Promise.all([
    page.waitForURL(/\/vendor\/seller-application/, { timeout: 20_000 }),
    startSelling.first().click(),
  ]);
}

/** Resolve store-list route to the active /stores directory. */
export async function openVendorStoreList(page) {
  await gotoOneDirectBuy(page, "/vendor/store-list");
  if (/store-list|404|not found/i.test(page.url() + (await page.title()))) {
    await openStoresPage(page);
    return;
  }
  const hasStores = await page
    .getByRole("heading", { name: /^Store list$/i })
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (!hasStores) {
    await openStoresPage(page);
  }
}

/** Open first store detail page when store cards exist. */
export async function openFirstStoreDetail(page) {
  await openStoresPage(page);
  const storeLink = page.locator('a[href*="/store/"]').first();
  await expect(storeLink).toBeVisible({ timeout: 30_000 });
  await Promise.all([
    page.waitForURL(/\/store\//, { timeout: 20_000 }),
    storeLink.click(),
  ]);
  await expect(page.getByText(/Loading store/i))
    .toBeHidden({ timeout: 45_000 })
    .catch(() => {});
}

/** Search stores using the vendor search input on /stores. */
export async function searchStores(page, keyword) {
  await openStoresPage(page);
  const searchInput = page.getByPlaceholder(/Search vendor/i);
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(keyword);
  await searchInput.press("Enter");
}

/** Assert product detail shows Sold by / seller info. */
export async function expectProductSellerInfo(page) {
  await openKnownProductDetail(page, "bearing").catch(async () => {
    await openFirstProductFromShop(page);
  });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Sold by\s*:/i).first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Open seller application form. */
export async function openSellerApplication(page) {
  await gotoOneDirectBuy(page, "/vendor/seller-application");
  await expect(
    page.getByRole("heading", { name: /Apply to sell on OneDirect Buy/i }),
  ).toBeVisible({ timeout: 30_000 });
}

const SELLER_CATALOG_PATHS = ["/vendor/products", "/vendor/dashboard"];

/**
 * True when a seller catalog/pricing/identifier workspace is on this storefront.
 * Live OneDirectBuy public site does not mount OneChannel seller tools.
 */
export async function sellerCatalogWorkspaceVisible(page) {
  for (const path of SELLER_CATALOG_PATHS) {
    await gotoOneDirectBuy(page, path);
    const catalogUi = page.getByText(
      /create variant|product variants|sale price|UPC|GTIN|MPN|variant inventory/i,
    );
    if (await catalogUi.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

export function sellerPortalNotOnStorefrontError(feature) {
  return `${feature} is not on the OneDirectBuy storefront (seller/admin catalog lives in OneChannel).`;
}

const SELLER_FITMENT_PATHS = [
  "/vendor/products",
  "/vendor/dashboard",
  "/vendor/fitment",
];

/** True when ACES/PIES upload UI is mounted on this storefront. */
export async function sellerFitmentUploadVisible(page) {
  for (const path of SELLER_FITMENT_PATHS) {
    await gotoOneDirectBuy(page, path);
    const ui = page.getByText(
      /ACES|PIES|fitment (file|upload|data)|upload (ACES|PIES)/i,
    );
    if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

const BRAND_APPROVAL_PATHS = [
  "/vendor/brands",
  "/vendor/brand-requests",
  "/vendor/dashboard",
  "/admin/brands",
  "/admin/brand-approval",
];

/** True when brand-approval / brand-request UI is mounted on this storefront. */
export async function brandApprovalWorkspaceVisible(page) {
  for (const path of BRAND_APPROVAL_PATHS) {
    await gotoOneDirectBuy(page, path);
    const ui = page.getByText(
      /brand approval|request (an? )?(existing )?brand|new brand|authorized brand|brand request/i,
    );
    if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

const PRODUCT_CATALOG_PATHS = [
  "/vendor/products",
  "/vendor/catalog",
  "/vendor/dashboard",
  "/admin/products",
  "/admin/catalog",
];

/** True when seller/admin product catalog tools are on this storefront. */
export async function sellerProductCatalogVisible(page) {
  if (await sellerCatalogWorkspaceVisible(page)) return true;
  for (const path of PRODUCT_CATALOG_PATHS) {
    await gotoOneDirectBuy(page, path);
    const ui = page.getByText(
      /add (a )?(new )?product|create product|product images|product (specs|specifications)|bulk (product |price |inventory )?upload|review product|approve product/i,
    );
    if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

const CATALOG_MASTER_PATHS = [
  "/vendor/import",
  "/vendor/export",
  "/vendor/catalog",
  "/vendor/products",
  "/admin/catalog",
  "/admin/categories",
  "/admin/attributes",
  "/admin/brands",
];

/** True when catalog import/export or category/attribute/brand master UI is mounted. */
export async function catalogMasterDataVisible(page) {
  if (await sellerProductCatalogVisible(page)) return true;
  for (const path of CATALOG_MASTER_PATHS) {
    await gotoOneDirectBuy(page, path);
    const ui = page.getByText(
      /import template|catalog import|export (seller |full |master )?catalog|create category|edit category|disable category|category attribute|create brand/i,
    );
    if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

const SELLER_INVENTORY_PATHS = [
  "/vendor/inventory",
  "/vendor/products",
  "/vendor/dashboard",
];

/** True when seller inventory / stock controls are mounted on this storefront. */
export async function sellerInventoryVisible(page) {
  if (await sellerCatalogWorkspaceVisible(page)) return true;
  for (const path of SELLER_INVENTORY_PATHS) {
    await gotoOneDirectBuy(page, path);
    const ui = page.getByText(
      /add (stock|inventory)|inventory quantity|on hand|warehouse stock|lead time|low stock/i,
    );
    if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}
