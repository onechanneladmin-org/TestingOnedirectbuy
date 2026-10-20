import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";
import {
  clickFooterNav,
  expectPublicHome,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

const MARKETING_PAGES = [
  { id: "OPH-PUBLIC-DATA-HUB-1", label: "Product Data Hub", heading: /product data|hub/i },
  { id: "OPH-PUBLIC-CATALOG-MGMT-1", label: "Product Catalog Management", heading: /catalog|product/i },
  { id: "OPH-PUBLIC-AI-ENRICHMENT-1", label: "AI Enrichment", heading: /AI|enrich/i },
  { id: "OPH-PUBLIC-BRAND-SHARING-1", label: "Brand Data Sharing", heading: /brand|shar|access/i },
  { id: "OPH-PUBLIC-CLIENT-ACCESS-REQ-1", label: "Client Access Requests", heading: /client|access|request/i },
  { id: "OPH-PUBLIC-MULTICHANNEL-1", label: "Multichannel Sync", heading: /channel|sync/i },
  { id: "OPH-PUBLIC-WEBSITE-SYNC-1", label: "Website Sync", heading: /website|sync/i },
  { id: "OPH-PUBLIC-SOLUTION-BRANDS-1", label: "Brands", heading: /brand/i },
  { id: "OPH-PUBLIC-SOLUTION-RETAIL-1", label: "Retailers", heading: /retail/i },
  { id: "OPH-PUBLIC-SOLUTION-MFG-1", label: "Manufacturers", heading: /manufacturer/i },
  { id: "OPH-PUBLIC-SOLUTION-DIST-1", label: "Distributors", heading: /distributor/i },
  { id: "OPH-PUBLIC-SOLUTION-DEALER-1", label: "Dealers", heading: /dealer/i },
  { id: "OPH-PUBLIC-SOLUTION-ECOM-1", label: "Ecommerce Teams", heading: /ecommerce|e-commerce|team/i },
  { id: "OPH-PUBLIC-SOLUTION-AUTO-1", label: "Automotive", heading: /automotive|vehicle/i },
  { id: "OPH-PUBLIC-SOLUTION-RENTAL-1", label: "Rental", heading: /rental/i },
  { id: "OPH-PUBLIC-SOLUTION-MEDICAL-1", label: "Medical", heading: /medical|health/i },
  { id: "OPH-PUBLIC-VARIANTS-1", label: "Variants", heading: /variant/i },
  { id: "OPH-PUBLIC-FITMENT-1", label: "Fitment", heading: /fitment|automotive/i },
  { id: "OPH-PUBLIC-CATEGORIES-1", label: "Categories", heading: /Multiple Categories|Taxonom/i },
  { id: "OPH-PUBLIC-BUNDLES-1", label: "Bundles", heading: /Bundles, Kits|Multipack/i },
  { id: "OPH-PUBLIC-DIGITAL-ASSETS-1", label: "Digital Assets", heading: /digital asset|Built for complex/i },
  { id: "OPH-PUBLIC-DOCUMENTS-1", label: "Documents", heading: /document|complex product data/i },
  { id: "OPH-PUBLIC-COMPLIANCE-1", label: "Compliance", heading: /compliance|complex product data/i },
  { id: "OPH-PUBLIC-MULTILINGUAL-1", label: "Multilingual", heading: /Multilingual and Regional/i },
  { id: "OPH-PUBLIC-BLOG-1", label: "Blog", heading: /blog|guide|article|insight/i },
  { id: "OPH-PUBLIC-RESOURCES-1", label: "Resources", heading: /resource|guide|help/i },
  { id: "OPH-PUBLIC-CONTACT-1", label: "Contact", heading: /contact|support|demo/i },
];

test.describe("One Product Hub V2 — public marketing pages", () => {
  test("visitor can open platform, company, and resource footer pages", async ({
    page,
    soft,
  }) => {
    for (const item of MARKETING_PAGES) {
      await soft(item.id, `Open public page: ${item.label}`, async () => {
        await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
        await expectPublicHome(page);
        await clickFooterNav(page, new RegExp(`^${item.label}$`, "i"));
        await expect(
          page
            .getByRole("heading", { name: item.heading })
            .or(page.getByText(item.heading))
            .locator("visible=true")
            .first(),
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        await capturePageOrModal(page, `Marketing — ${String(item.label)}`);
      });
    }
  });
});
