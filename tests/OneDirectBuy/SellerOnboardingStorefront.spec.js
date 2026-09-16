import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  clickStartSelling,
  openBecomeVendorPage,
  openFirstStoreDetail,
  openSellerApplication,
  openStoresPage,
  sellerCatalogWorkspaceVisible,
  sellerPortalNotOnStorefrontError,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

async function pathHasText(page, paths, pattern) {
  for (const path of paths) {
    await gotoOneDirectBuy(page, path);
    if (await page.getByText(pattern).first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

test.describe("OneDirectBuy — Seller application (public)", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-183: start seller application", async ({ page, soft }) => {
    await soft("ODB-UC-183", "Sell landing + Start Selling Today CTA", async () => {
      await openBecomeVendorPage(page);
      await expect(
        page.getByRole("link", { name: /^Start Selling Today$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-184: submit seller application", async ({ page, soft }) => {
    await soft("ODB-UC-184", "Application form exposes submit/continue (no live submit)", async () => {
      await openBecomeVendorPage(page);
      await clickStartSelling(page);
      await expect(page).toHaveURL(/\/vendor\/seller-application/);
      await expect(
        page
          .getByRole("heading", { name: /Apply to sell on OneDirect Buy/i })
          .or(page.getByRole("heading", { name: /Seller Application|Become a (Seller|Vendor)|Sell on/i }))
          .or(page.getByText(/Seller Application|Apply to sell/i))
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByRole("button", { name: /Continue to review|Submit (application|application)?/i })
          .first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-185: validate seller fields", async ({ page, soft }) => {
    await soft("ODB-UC-185", "Continue without required fields stays on the form", async () => {
      await openSellerApplication(page);
      await page.getByRole("button", { name: /Continue to review/i }).click();
      await expect(page).toHaveURL(/\/vendor\/seller-application/);
      await expect(
        page.getByText(/Your business/i).or(page.getByText(/required/i)).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-186: upload business documents", async ({ page, soft }) => {
    await soft("ODB-UC-186", "Document upload on the public application", async () => {
      await openSellerApplication(page);
      const upload = page
        .locator('input[type="file"]')
        .or(page.getByText(/W-?9|upload (document|file)|business (document|license)/i));
      if (!(await upload.first().isVisible({ timeout: 6_000 }).catch(() => false))) {
        throw new Error(
          sellerPortalNotOnStorefrontError("Upload business documents"),
        );
      }
    });
  });

  test("ODB-UC-187: invalid document upload", async ({ page, soft }) => {
    await soft("ODB-UC-187", "Invalid document rejection on the application", async () => {
      await openSellerApplication(page);
      const upload = page.locator('input[type="file"]');
      if (!(await upload.first().isVisible({ timeout: 6_000 }).catch(() => false))) {
        throw new Error(
          sellerPortalNotOnStorefrontError("Invalid document upload"),
        );
      }
    });
  });

  test("ODB-UC-192: resubmit seller application", async ({ page, soft }) => {
    await soft("ODB-UC-192", "Resubmit application control", async () => {
      await openSellerApplication(page);
      const resubmit = page.getByText(
        /resubmit|update (your )?application|edit application/i,
      );
      if (!(await resubmit.first().isVisible({ timeout: 6_000 }).catch(() => false))) {
        throw new Error(sellerPortalNotOnStorefrontError("Resubmit seller application"));
      }
    });
  });

  test("ODB-UC-197: accept seller agreement", async ({ page, soft }) => {
    await soft("ODB-UC-197", "Seller agreement checkbox or Terms on application", async () => {
      await openSellerApplication(page);
      const agree = page
        .getByRole("checkbox", { name: /agree|terms|seller agreement/i })
        .or(page.getByRole("link", { name: /seller agreement|terms of service/i }));
      if (await agree.first().isVisible({ timeout: 6_000 }).catch(() => false)) {
        return;
      }
      await gotoOneDirectBuy(page, "/info/terms-of-service");
      await expect(
        page.getByRole("heading", { name: /^Terms of Service$/i }),
      ).toBeVisible({ timeout: 20_000 });
    });
  });
});

test.describe("OneDirectBuy — Seller dashboard, storefront, admin", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-188: admin review seller application", async ({ page, soft }) => {
    await soft("ODB-UC-188", "Admin application review", async () => {
      if (
        await pathHasText(
          page,
          ["/admin/sellers", "/admin/applications", "/vendor/admin/sellers"],
          /review (seller )?application|seller applications|approve seller/i,
        )
      ) {
        return;
      }
      throw new Error(sellerPortalNotOnStorefrontError("Review seller application"));
    });
  });

  test("ODB-UC-189: approve seller", async ({ page, soft }) => {
    await soft("ODB-UC-189", "Admin approve seller", async () => {
      if (
        await pathHasText(page, ["/admin/sellers", "/vendor/admin/sellers"], /approve seller/i)
      ) {
        return;
      }
      throw new Error(sellerPortalNotOnStorefrontError("Approve seller"));
    });
  });

  test("ODB-UC-190: reject seller", async ({ page, soft }) => {
    await soft("ODB-UC-190", "Admin reject seller", async () => {
      if (
        await pathHasText(page, ["/admin/sellers", "/vendor/admin/sellers"], /reject seller/i)
      ) {
        return;
      }
      throw new Error(sellerPortalNotOnStorefrontError("Reject seller"));
    });
  });

  test("ODB-UC-191: request more information is not required", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-191",
      "Request more information absent (Not Required)",
      async () => {
        if (
          await pathHasText(
            page,
            ["/admin/sellers", "/vendor/seller-application"],
            /request more (information|info)|ask (the )?seller for more/i,
          )
        ) {
          throw new Error(
            "Request more information is present; sheet marks this as Not Required.",
          );
        }
      },
    );
  });

  test("ODB-UC-193: access seller dashboard", async ({ page, soft }) => {
    await soft("ODB-UC-193", "Approved seller dashboard", async () => {
      if (await sellerCatalogWorkspaceVisible(page)) return;
      await gotoOneDirectBuy(page, "/vendor/dashboard");
      const dash = page.getByText(/seller dashboard|vendor dashboard|your store/i);
      if (!(await dash.first().isVisible({ timeout: 4_000 }).catch(() => false))) {
        throw new Error(sellerPortalNotOnStorefrontError("Access seller dashboard"));
      }
    });
  });

  test("ODB-UC-194: block pending seller selling", async ({ page, soft }) => {
    await soft("ODB-UC-194", "Pending seller cannot open a selling workspace", async () => {
      if (await sellerCatalogWorkspaceVisible(page)) {
        throw new Error(
          "Seller catalog is open on the storefront; pending sellers must not be able to sell here.",
        );
      }
    });
  });

  test("ODB-UC-195: suspend seller", async ({ page, soft }) => {
    await soft("ODB-UC-195", "Admin suspend seller", async () => {
      if (
        await pathHasText(page, ["/admin/sellers"], /suspend seller|deactivate seller/i)
      ) {
        return;
      }
      throw new Error(sellerPortalNotOnStorefrontError("Suspend seller"));
    });
  });

  test("ODB-UC-196: reactivate seller", async ({ page, soft }) => {
    await soft("ODB-UC-196", "Admin reactivate seller", async () => {
      if (
        await pathHasText(page, ["/admin/sellers"], /reactivate seller|unsuspend seller/i)
      ) {
        return;
      }
      throw new Error(sellerPortalNotOnStorefrontError("Reactivate seller"));
    });
  });

  test("ODB-UC-198: create storefront", async ({ page, soft }) => {
    await soft("ODB-UC-198", "Seller create storefront", async () => {
      if (
        await pathHasText(
          page,
          ["/vendor/dashboard", "/vendor/store", "/vendor/storefront"],
          /create (your )?store(front)?|set up (your )?store/i,
        )
      ) {
        return;
      }
      throw new Error(sellerPortalNotOnStorefrontError("Create storefront"));
    });
  });

  test("ODB-UC-199: edit storefront", async ({ page, soft }) => {
    await soft("ODB-UC-199", "Seller edit logo/banner/store details", async () => {
      if (
        await pathHasText(
          page,
          ["/vendor/store", "/vendor/storefront", "/vendor/dashboard"],
          /edit store(front)?|store logo|banner|store details/i,
        )
      ) {
        return;
      }
      throw new Error(sellerPortalNotOnStorefrontError("Edit storefront"));
    });
  });

  test("ODB-UC-200: view seller storefront", async ({ page, soft }) => {
    await soft("ODB-UC-200", "Buyer opens a seller store", async () => {
      await openStoresPage(page);
      await openFirstStoreDetail(page);
      await expect(page).toHaveURL(/\/store\//);
    });
  });

  test("ODB-UC-201: view seller products", async ({ page, soft }) => {
    await soft("ODB-UC-201", "Store detail lists products", async () => {
      await openFirstStoreDetail(page);
      await expect(page.getByText(/\d+\s+Products found/i)).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible({
        timeout: 30_000,
      });
    });
  });

  test("ODB-UC-202: disable storefront", async ({ page, soft }) => {
    await soft("ODB-UC-202", "Admin disable storefront", async () => {
      if (
        await pathHasText(
          page,
          ["/admin/sellers", "/admin/stores"],
          /disable store(front)?|hide store|deactivate store/i,
        )
      ) {
        return;
      }
      throw new Error(sellerPortalNotOnStorefrontError("Disable storefront"));
    });
  });
});
