import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  expectHeading,
} from "../helpers/oneProductHubV2Nav.js";

const ADMIN_NAV = [
  { id: "OPH-NAV-ADMIN-PLATFORM-1", label: "Platform", heading: /Admin Dashboard|Platform/i },
  { id: "OPH-NAV-ADMIN-WORKSPACE-1", label: "Workspace", heading: /Workspace|Overview|Brand/i },
  { id: "OPH-NAV-ADMIN-BRAND-DIRECTORY-1", label: "Brand Directory", heading: /Brand Directory/i },
  { id: "OPH-NAV-ADMIN-CLIENTS-1", label: "Clients", heading: /Client/i },
  { id: "OPH-NAV-ADMIN-BRAND-REGISTRY-1", label: "Brand Registry", heading: /Brand Registry|Brand/i },
  { id: "OPH-NAV-ADMIN-PRODUCT-CATALOG-1", label: "Product Catalog", heading: /Product Catalog|Catalog/i },
  { id: "OPH-NAV-ADMIN-AI-PRODUCT-STUDIO-1", label: "AI Product Studio", heading: /Product Catalog|AI Product|Studio/i },
  { id: "OPH-NAV-ADMIN-DISTRIBUTIONS-1", label: "Distributions", heading: "Product Distribution" },
  { id: "OPH-NAV-ADMIN-EXPORT-CENTER-1", label: "Export Center", heading: "Product Export" },
  { id: "OPH-NAV-ADMIN-IMPORT-CENTER-1", label: "Import Center", heading: /Import/i },
  { id: "OPH-NAV-ADMIN-PRODUCT-CHANGE-LOG-1", label: "Product Change Log", heading: /Change Log|Changelog|Product Change/i },
  { id: "OPH-NAV-ADMIN-RBAC-ACCESS-1", label: "RBAC Access", heading: /RBAC/i },
  { id: "OPH-NAV-ADMIN-SETTINGS-1", label: "Settings", heading: /Settings|Profile/i },
];

test.describe("One Product Hub V2 — admin nav matrix", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("every admin sidebar destination opens without error", async ({
    page,
    soft,
  }) => {
    await signInAsAdmin(page);

    for (const item of ADMIN_NAV) {
      await soft(item.id, `Admin nav: ${item.label}`, async () => {
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
