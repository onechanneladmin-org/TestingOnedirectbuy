import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  expectHeading,
} from "../helpers/oneProductHubV2Nav.js";

const CLIENT_NAV = [
  { id: "OPH-NAV-CLIENT-DASHBOARD-1", label: "Dashboard", heading: /Welcome back,/i },
  { id: "OPH-NAV-CLIENT-BRAND-DIRECTORY-1", label: "Brand Directory", heading: /Brand Directory/i },
  { id: "OPH-NAV-CLIENT-PRODUCT-CATALOG-1", label: "Product Catalog", heading: /Product Catalog|Catalog/i },
  { id: "OPH-NAV-CLIENT-EXPORT-CENTER-1", label: "Export Center", heading: "Product Export" },
  { id: "OPH-NAV-CLIENT-PRODUCT-CHANGE-LOG-1", label: "Product Change Log", heading: /Change Log|Changelog|Product Change/i },
  { id: "OPH-NAV-CLIENT-BLOG-GUIDES-1", label: "Blog & Guides", heading: /Blog|Guide|Article|Insight|Resource/i },
  { id: "OPH-NAV-CLIENT-SETTINGS-1", label: "Settings", heading: /Settings|Profile/i },
  { id: "OPH-NAV-CLIENT-SUBSCRIPTION-1", label: "Subscription", heading: /Subscription/i },
];

test.describe("One Product Hub V2 — client nav matrix", () => {
  test("every client sidebar destination opens without error", async ({
    page,
    soft,
  }) => {
    await signInAsClient(page);

    for (const item of CLIENT_NAV) {
      await soft(item.id, `Client nav: ${item.label}`, async () => {
        await clickSidebarNav(page, item.label);
        await expectHeading(page, item.heading);
        await expect(page.getByText(/something went wrong|unexpected error/i)).toHaveCount(
          0
        );
      });
    }

    await expect(
      page.locator("nav").getByRole("button", { name: /Import Center/i })
    ).toHaveCount(0);
    await expect(
      page.locator("nav").getByRole("button", { name: /AI Product Studio/i })
    ).toHaveCount(0);
  });
});
