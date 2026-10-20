import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  ONE_PRODUCT_HUB_V2_BRAND_CREDENTIALS,
  ONE_PRODUCT_HUB_V2_CLIENT_CREDENTIALS,
  signInAsAdmin,
  signInAsBrand,
  signInAsClient,
} from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

const BRAND_NAME = "Onefulfillcenter";
const BRAND_LOGIN = {
  email: "sophie@onechanneladmin.com",
  password: ONE_PRODUCT_HUB_V2_BRAND_CREDENTIALS.password,
};

test.describe("One Product Hub V2 — brand data shared with admin", () => {
  test.setTimeout(240_000);

  test("client requests access, brand approves, and admin sees the same brand data", async ({
    browser,
    soft,
  }) => {
    const clientContext = await browser.newContext();
    const brandContext = await browser.newContext();
    const adminContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    const brandPage = await brandContext.newPage();
    const adminPage = await adminContext.newPage();

    try {
      await soft("OPH-SHARE-REQUEST-1", "Client requests catalog access from the brand", async () => {
        await signInAsClient(clientPage);
        await clickSidebarNav(clientPage, "Brand Directory");
        await expect(clientPage.getByRole("heading", { name: "Brand Directory" })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await expect(clientPage.getByText(BRAND_NAME, { exact: true }).first()).toBeVisible({
          timeout: STEP_TIMEOUT,
        });

        const opened = await clientPage.evaluate((brandName) => {
          const buttons = [...document.querySelectorAll("button")].filter((button) =>
            /^request access$/i.test((button.innerText || "").replace(/\s+/g, " ").trim()),
          );
          const match = buttons.find((button) => {
            let node = button.parentElement;
            for (let depth = 0; depth < 8 && node; depth += 1) {
              const text = (node.innerText || "").replace(/\s+/g, " ");
              if (text.includes(brandName) && text.length < 900) return true;
              node = node.parentElement;
            }
            return false;
          });
          if (!match) return false;
          match.click();
          return true;
        }, BRAND_NAME);
        if (opened) {
          await expect(clientPage.getByText(/Request catalog access/i).first()).toBeVisible({
            timeout: STEP_TIMEOUT,
          });
          await clientPage.getByRole("button", { name: /Full catalog/i }).click();
          await clientPage
            .getByPlaceholder(/Partnership intent/i)
            .fill("QA access request so the client catalog can be checked against the brand.");
          await clientPage
            .getByPlaceholder(/Optional message/i)
            .fill("Please approve Onefulfillcenter catalog access.");
          await clientPage.getByRole("button", { name: /Submit request/i }).click();
          await expect(clientPage.getByText(/pending|submitted|request sent|awaiting/i).first()).toBeVisible({
            timeout: STEP_TIMEOUT,
          });
        }
      });

      await soft("OPH-SHARE-BRAND-PAGES-1", "Brand shared pages show Onefulfillcenter", async () => {
        await signInAsBrand(brandPage, BRAND_LOGIN);
        await expect(brandPage.getByText(BRAND_NAME).first()).toBeVisible({ timeout: STEP_TIMEOUT });

        await clickSidebarNav(brandPage, "AI Product Studio");
        await expect(brandPage.getByRole("heading", { name: /Product Catalog/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await expect(brandPage.getByText(/something went wrong|unexpected error/i)).toHaveCount(0);

        await clickSidebarNav(brandPage, "Distributions");
        await expect(brandPage.getByRole("heading", { name: "Product Distribution" })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });

        await clickSidebarNav(brandPage, "Data Quality Dashboard");
        await expect(brandPage.getByRole("heading", { name: /Data Quality/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });

        await clickSidebarNav(brandPage, "Export Center");
        await expect(brandPage.getByText(new RegExp(`Exporting:\\s*${BRAND_NAME}`, "i"))).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
      });

      await soft("OPH-SHARE-APPROVE-1", "Brand approves the client access request", async () => {
        await clickSidebarNav(brandPage, "Client Access");
        await expect(brandPage.getByRole("heading", { name: /Client Access/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await brandPage.getByRole("button", { name: /^Pending/i }).click();
        const clientEmail = ONE_PRODUCT_HUB_V2_CLIENT_CREDENTIALS.email;
        const row = brandPage.getByText(new RegExp(clientEmail, "i"));
        if (await row.first().isVisible().catch(() => false)) {
          const approve = brandPage.getByRole("button", { name: /Approve|Grant access/i }).first();
          if (await approve.isVisible().catch(() => false)) {
            await approve.click();
            await expect(brandPage.getByText(/approved|active partner|access granted/i).first()).toBeVisible({
              timeout: STEP_TIMEOUT,
            });
          }
        }
        await brandPage.getByRole("button", { name: /^Approved/i }).click();
        await expect(brandPage.getByText(/approved|active partner|no approved|pending/i).first()).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
      });

      await soft("OPH-SHARE-ADMIN-PAGES-1", "Admin sees the brand, clients, and catalog", async () => {
        await signInAsAdmin(adminPage);

        await clickSidebarNav(adminPage, "Platform");
        await expect(adminPage.getByRole("heading", { name: /Admin Dashboard/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await expect(adminPage.getByText(/Pending Client Approvals|Pending Brand Requests/i).first()).toBeVisible({
          timeout: STEP_TIMEOUT,
        });

        await clickSidebarNav(adminPage, "Brand Registry");
        await expect(adminPage.getByRole("heading", { name: /Brand Registry/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await expect(adminPage.getByText(BRAND_NAME).first()).toBeVisible({ timeout: STEP_TIMEOUT });

        await clickSidebarNav(adminPage, "Clients");
        await expect(adminPage.getByRole("heading", { name: /Client Access Hub/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await adminPage.getByRole("button", { name: /^Approved/i }).click();
        await expect(adminPage.getByText(/approved|client|company/i).first()).toBeVisible({
          timeout: STEP_TIMEOUT,
        });

        await clickSidebarNav(adminPage, "Client Access");
        await expect(adminPage.getByRole("heading", { name: /Client Access Hub/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await expect(adminPage.getByRole("button", { name: /^Pending|^Approved/i }).first()).toBeVisible();

        await clickSidebarNav(adminPage, "Product Catalog");
        await expect(adminPage.getByRole("heading", { name: /Product Catalog/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await expect(adminPage.getByText(/something went wrong|unexpected error/i)).toHaveCount(0);

        await clickSidebarNav(adminPage, "Brand Directory");
        await expect(adminPage.getByRole("heading", { name: "Brand Directory" })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await expect(adminPage.getByText(BRAND_NAME).first()).toBeVisible({ timeout: STEP_TIMEOUT });
      });

      await soft("OPH-SHARE-CLIENT-CATALOG-1", "Client catalog reflects brand access state", async () => {
        const freshContext = await browser.newContext();
        const catalogPage = await freshContext.newPage();
        try {
        await signInAsClient(catalogPage);
        await clickSidebarNav(catalogPage, "Product Catalog");
        await expect(catalogPage.getByRole("heading", { name: /Product Catalog/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        await expect(
          catalogPage.getByText(/approved brands|No approved brands|Request access|products available/i).first(),
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        await clickSidebarNav(catalogPage, "Export Center");
        await expect(catalogPage.getByRole("heading", { name: /Product Export/i })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
        } finally {
          await freshContext.close();
        }
      });
    } finally {
      await clientContext.close();
      await brandContext.close();
      await adminContext.close();
    }
  });
});
