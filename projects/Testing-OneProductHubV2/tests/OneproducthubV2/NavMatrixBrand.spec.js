import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  expectHeading,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

const BRAND_NAV = [
  { id: "OPH-NAV-BRAND-DASHBOARD-1", label: "Dashboard", heading: /Workspace Overview|Dashboard/i },
  { id: "OPH-NAV-BRAND-AI-PRODUCT-STUDIO-1", label: "AI Product Studio", heading: /Product Catalog|AI Product|Studio/i },
  { id: "OPH-NAV-BRAND-DISTRIBUTIONS-1", label: "Distributions", heading: "Product Distribution" },
  { id: "OPH-NAV-BRAND-CLIENT-ACCESS-1", label: "Client Access", heading: /Client Access/i },
  { id: "OPH-NAV-BRAND-DATA-QUALITY-1", label: "Data Quality Dashboard", heading: /Data Quality/i },
  { id: "OPH-NAV-BRAND-EXPORT-CENTER-1", label: "Export Center", heading: "Product Export" },
  { id: "OPH-NAV-BRAND-IMPORT-CENTER-1", label: "Import Center", heading: /Import/i },
  { id: "OPH-NAV-BRAND-PRODUCT-CHANGE-LOG-1", label: "Product Change Log", heading: /Change Log|Changelog|Product Change/i },
  { id: "OPH-NAV-BRAND-SETTINGS-1", label: "Settings", heading: /Settings|Profile/i },
  { id: "OPH-NAV-BRAND-SUBSCRIPTION-1", label: "Subscription", heading: /Subscription/i },
];

test.describe("One Product Hub V2 — brand nav matrix", () => {
  test("every brand sidebar destination opens without error", async ({
    page,
    soft,
  }) => {
    await signInAsBrand(page);

    for (const item of BRAND_NAV) {
      await soft(item.id, `Brand nav: ${item.label}`, async () => {
        await clickSidebarNav(page, item.label);
        await expectHeading(page, item.heading);
        await expect(page.getByText(/something went wrong|unexpected error/i)).toHaveCount(
          0
        );
      });
    }

    await expect(
      page.locator("nav").getByRole("button", { name: /Digital Shelf/i })
    ).toHaveCount(0);
  });
});
