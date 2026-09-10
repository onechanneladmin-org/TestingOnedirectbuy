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
  { id: "OPH-PUBLIC-VARIANTS-1", label: "Variants", heading: /variant/i },
  { id: "OPH-PUBLIC-FITMENT-1", label: "Fitment", heading: /fitment|automotive/i },
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
            .or(page.getByText(item.heading).first())
            .first(),
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        await capturePageOrModal(page, `Marketing — ${String(item.label)}`);
      });
    }
  });
});
