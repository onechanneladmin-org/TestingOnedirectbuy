import { test } from "../helpers/softTest.js";

/**
 * Remaining seller catalog/inventory skips from seller.csv (OneChannel).
 * Product add/images/specs/resubmit/edit/bulk live in ProductCatalog.spec.js (Flow 25).
 * Catalog export/attributes live in CatalogImportExport.spec.js (Flow 26).
 * Inventory add/reduce/negative live in SellerInventory.spec.js (Flow 27).
 * Brand request (203–204) lives in BrandApproval.spec.js.
 */
const BACKEND_ONLY_CASES = [
  ["ODB-UC-077", "Variant-level inventory per seller"],
  ["ODB-UC-081", "Update product price"],
  ["ODB-UC-082", "Prevent negative price"],
  ["ODB-UC-083", "Add sale price"],
  ["ODB-UC-087", "Add UPC/GTIN/MPN"],
  ["ODB-UC-088", "Invalid UPC validation"],
  ["ODB-UC-104", "Upload ACES fitment file"],
  ["ODB-UC-106", "Upload PIES file"],
  ["ODB-UC-107", "Invalid PIES file rejection"],
  ["ODB-UC-293", "Approve buyer return request"],
  ["ODB-UC-317", "Submit seller rating after order"],
  ["ODB-UC-320", "Respond to buyer review"],
  ["ODB-UC-330", "Send seller approval notification"],
  ["ODB-UC-509", "Large bulk upload performance"],
  ["ODB-UC-512", "Bulk upload recovery after failure"],
];

test.describe("OneDirectBuy — Seller catalog & inventory (backend portal)", () => {
  for (const [id, title] of BACKEND_ONLY_CASES) {
    test(`${id}: ${title} — tracked, requires seller backend`, async () => {
      test.skip(
        true,
        "Automate in OneChannel Admin / seller portal when ONEDIRECTBUY_SELLER credentials and routes are available.",
      );
    });
  }
});
