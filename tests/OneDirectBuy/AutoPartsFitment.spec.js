import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  openCheckoutWithCart,
  searchProducts,
  waitForShopProducts,
} from "../helpers/oneDirectBuyNav.js";
import { openGuestPdp } from "../helpers/oneDirectBuyPdp.js";
import {
  applyYmmAndFindParts,
  clearSelectedVehicle,
  clickFindParts,
  compatibilityCopy,
  doesNotFitMessage,
  engineField,
  fillVehicleYearMakeModel,
  fitsVehicleMessage,
  openAddNewVehicleForm,
  openLicensePlateTab,
  openMyVehiclesPanel,
  openVehicleFromMobileBar,
  removeFirstSavedVehicle,
  saveYmmVehicleToGarage,
  setDefaultSavedVehicle,
  submitVinLookup,
  trimField,
  useFirstSavedVehicle,
  vinDecodedVehicle,
  vinLookupError,
} from "../helpers/oneDirectBuyFitment.js";
import {
  sellerFitmentUploadVisible,
  sellerPortalNotOnStorefrontError,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };
const SAMPLE_VIN = "1HGCM82633A004352";
const INVALID_VIN = "XXXXXXXXXXXXXXXXX";

async function requireSellerFitment(page, feature) {
  if (await sellerFitmentUploadVisible(page)) return;
  throw new Error(sellerPortalNotOnStorefrontError(feature));
}

test.describe("OneDirectBuy — Auto Parts Fitment, VIN, and Garage", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoOneDirectBuy(page, "/");
  });

  test("ODB-UC-091: search by year, make, model", async ({ page, soft }) => {
    await soft(
      "ODB-UC-091-a",
      "Hero promotes Find Parts That Fit Your Vehicle",
      async () => {
        await expect(
          page.getByRole("heading", {
            name: /Find Parts That Fit Your Vehicle/i,
          }),
        ).toBeVisible();
      },
    );

    await soft(
      "ODB-UC-091-b",
      "Select Vehicle expands My Vehicles garage panel",
      async () => {
        await openMyVehiclesPanel(page);
        await expect(
          page.getByText(/Select a vehicle to see compatible parts/i),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: /^Add Vehicle$/i }),
        ).toBeVisible();
      },
    );

    await soft(
      "ODB-UC-091-c",
      "Year/Make/Model then Find Parts returns a listing",
      async () => {
        await openAddNewVehicleForm(page);
        const picked = await fillVehicleYearMakeModel(page, { year: "2020" });
        expect(picked.year).toBeTruthy();
        expect(picked.make).toBeTruthy();
        expect(picked.model).toBeTruthy();
        await clickFindParts(page);
        await waitForShopProducts(page).catch(async () => {
          await expect(
            page.locator('a[href*="/product/"]').first(),
          ).toBeVisible({ timeout: 60_000 });
        });
      },
    );

    await soft(
      "ODB-UC-091-d",
      "390px bottom Vehicle bar opens garage",
      async () => {
        await openVehicleFromMobileBar(page);
        await expect(
          page.getByRole("button", { name: /^Add Vehicle$/i }),
        ).toBeVisible();
      },
    );
  });

  test("ODB-UC-092: search by engine/trim", async ({ page, soft }) => {
    await soft(
      "ODB-UC-092",
      "Trim and engine fields are available after YMM",
      async () => {
        await openAddNewVehicleForm(page);
        await expect(trimField(page)).toBeVisible();
        await expect(engineField(page)).toBeVisible();
        await fillVehicleYearMakeModel(page, { year: "2020" });
        await trimField(page).fill("Sport");
        await engineField(page).fill("2.0L");
        await expect(
          page.getByRole("button", { name: /^Find Parts$/i }),
        ).toBeEnabled({ timeout: 15_000 });
      },
    );
  });

  test("ODB-UC-093: product compatibility display", async ({ page, soft }) => {
    await soft(
      "ODB-UC-093",
      "PDP shows vehicle compatibility after YMM search",
      async () => {
        await applyYmmAndFindParts(page);
        const product = page.locator('a[href*="/product/"]').first();
        if (await product.isVisible({ timeout: 20_000 }).catch(() => false)) {
          await product.click();
          await page.waitForURL(/\/product\//, { timeout: 20_000 }).catch(() => {});
        } else {
          await openGuestPdp(page, "bearing");
        }
        if (
          !(await compatibilityCopy(page)
            .first()
            .isVisible({ timeout: 8_000 })
            .catch(() => false))
        ) {
          throw new Error(
            "Product page has no vehicle compatibility / fitment copy after a YMM search.",
          );
        }
      },
    );
  });

  test("ODB-UC-094: Fits vehicle message", async ({ page, soft }) => {
    await soft("ODB-UC-094", "Product shows Fits for the selected vehicle", async () => {
      await applyYmmAndFindParts(page);
      const product = page.locator('a[href*="/product/"]').first();
      if (await product.isVisible({ timeout: 20_000 }).catch(() => false)) {
        await product.click();
        await page.waitForURL(/\/product\//, { timeout: 20_000 }).catch(() => {});
      } else {
        await openGuestPdp(page, "bearing");
      }
      if (
        !(await fitsVehicleMessage(page)
          .first()
          .isVisible({ timeout: 8_000 })
          .catch(() => false))
      ) {
        throw new Error(
          'Product page does not show a "Fits your vehicle" message after selecting a vehicle.',
        );
      }
    });
  });

  test("ODB-UC-095: Does not fit warning", async ({ page, soft }) => {
    await soft(
      "ODB-UC-095",
      "Product can warn when it does not fit the vehicle",
      async () => {
        await applyYmmAndFindParts(page);
        await openGuestPdp(page, "bearing");
        if (
          !(await doesNotFitMessage(page)
            .first()
            .isVisible({ timeout: 6_000 })
            .catch(() => false))
        ) {
          throw new Error(
            'No "Does not fit" warning on the product page for the selected vehicle.',
          );
        }
      },
    );
  });

  test("ODB-UC-096: valid VIN lookup", async ({ page, soft }) => {
    await soft("ODB-UC-096", "A valid VIN decodes to a vehicle", async () => {
      await submitVinLookup(page, SAMPLE_VIN);
      const decoded = await vinDecodedVehicle(page)
        .first()
        .isVisible({ timeout: 20_000 })
        .catch(() => false);
      const failed = await vinLookupError(page)
        .first()
        .isVisible({ timeout: 2_000 })
        .catch(() => false);
      if (failed || !decoded) {
        throw new Error(
          `VIN lookup did not decode a vehicle for ${SAMPLE_VIN}.`,
        );
      }
    });
  });

  test("ODB-UC-097: invalid VIN lookup", async ({ page, soft }) => {
    await soft("ODB-UC-097", "An invalid VIN shows an error", async () => {
      await submitVinLookup(page, INVALID_VIN);
      if (
        !(await vinLookupError(page)
          .first()
          .isVisible({ timeout: 15_000 })
          .catch(() => false))
      ) {
        throw new Error("Invalid VIN did not show an error after lookup.");
      }
    });
  });

  test("ODB-UC-098: license plate lookup", async ({ page, soft }) => {
    await soft("ODB-UC-098", "Buyer can search fitment by license plate", async () => {
      await openLicensePlateTab(page);
      const plate = page
        .getByRole("textbox", { name: /plate|license/i })
        .or(page.getByPlaceholder(/plate|license/i));
      await expect(plate.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test("ODB-UC-099: save vehicle to garage", async ({ page, soft }) => {
    await soft("ODB-UC-099", "Buyer saves a vehicle to the garage", async () => {
      const picked = await saveYmmVehicleToGarage(page);
      await expect(
        page.getByText(new RegExp(picked.year, "i")).first(),
      ).toBeVisible();
      await expect(
        page.getByText(new RegExp(picked.make, "i")).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-100: use saved vehicle", async ({ page, soft }) => {
    await soft("ODB-UC-100", "A saved garage vehicle can be applied", async () => {
      await saveYmmVehicleToGarage(page);
      await useFirstSavedVehicle(page);
      const header = page.getByRole("button", { name: /Select Vehicle/i }).first();
      const applied = page.getByRole("button").filter({ hasText: /\d{4}/ }).first();
      const stillSelect =
        (await header.isVisible().catch(() => false)) &&
        (await header.innerText().catch(() => "")).trim() === "Select Vehicle";
      if (stillSelect && !(await applied.isVisible().catch(() => false))) {
        throw new Error("Saved vehicle was not applied as the active vehicle.");
      }
    });
  });

  test("ODB-UC-101: remove saved vehicle", async ({ page, soft }) => {
    await soft("ODB-UC-101", "Buyer can remove a saved vehicle", async () => {
      await saveYmmVehicleToGarage(page);
      await removeFirstSavedVehicle(page);
      await expect(page.getByText(/No saved vehicles yet/i)).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test("ODB-UC-102: set default vehicle", async ({ page, soft }) => {
    await soft("ODB-UC-102", "Buyer can set a default garage vehicle", async () => {
      await saveYmmVehicleToGarage(page);
      await setDefaultSavedVehicle(page);
      await expect(
        page.getByText(/default/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test("ODB-UC-103: clear selected vehicle", async ({ page, soft }) => {
    await soft("ODB-UC-103", "Buyer can clear the active vehicle", async () => {
      await saveYmmVehicleToGarage(page);
      await useFirstSavedVehicle(page);
      await clearSelectedVehicle(page);
      await expect(
        page.getByRole("button", { name: /^Select Vehicle$/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-109: OEM part number search", async ({ page, soft }) => {
    await soft(
      "ODB-UC-109",
      "Search keyword 60431 (SKU) shows results",
      async () => {
        await searchProducts(page, "60431");
        await expect(
          page.getByRole("heading", { name: /Search result for/i }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(
          page
            .getByText(/60431|SKU|bearing|product/i)
            .or(page.locator('a[href*="/product/"]'))
            .first(),
        ).toBeVisible({ timeout: 30_000 });
      },
    );
  });

  test("ODB-UC-110: interchange part search is later-version", async ({
    soft,
  }) => {
    await soft(
      "ODB-UC-110",
      "Interchange part search (Later versions to include)",
      async () => {
        throw new Error(
          "Interchange part search is not implemented on the storefront (sheet: Later versions to include).",
        );
      },
    );
  });

  test("ODB-UC-111: generate fitment SEO pages", async ({ page, soft }) => {
    await soft(
      "ODB-UC-111",
      "Year/make/model SEO pages (New Functionality)",
      async () => {
        const seoPaths = [
          "/fitment",
          "/vehicles",
          "/parts-for",
          "/2020-ford-f-150",
        ];
        for (const path of seoPaths) {
          await gotoOneDirectBuy(page, path);
          const body = await page.locator("body").innerText().catch(() => "");
          if (
            /fitment (seo )?page|parts for your \d{4}|year.?make.?model/i.test(
              body,
            ) &&
            !/404|not found|no healthy upstream/i.test(body)
          ) {
            return;
          }
          if (/\/\d{4}-[a-z0-9-]+/i.test(page.url()) && !/404/.test(body)) {
            return;
          }
        }
        throw new Error(
          "Dedicated year/make/model fitment SEO pages are not on the storefront (sheet: New Functionality).",
        );
      },
    );
  });

  test("ODB-UC-112: checkout fitment warning", async ({ page, soft }) => {
    await soft(
      "ODB-UC-112",
      "Checkout warns if a cart item may not fit",
      async () => {
        await applyYmmAndFindParts(page);
        await openCheckoutWithCart(page);
        const warning = page.getByText(
          /may not fit|does not fit|fitment warning|check (that )?this (part|item) fits|vehicle (fit|compatibility)/i,
        );
        if (!(await warning.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
          throw new Error(
            "Checkout has no fitment warning for the selected vehicle.",
          );
        }
      },
    );
  });
});

test.describe("OneDirectBuy — Seller ACES/PIES and admin fitment", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-104: seller uploads ACES file", async ({ page, soft }) => {
    await soft("ODB-UC-104", "ACES upload in seller catalog", async () => {
      await requireSellerFitment(page, "Upload ACES file");
    });
  });

  test("ODB-UC-105: invalid ACES file is not required", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-105",
      "Invalid ACES rejection absent (Not Required)",
      async () => {
        if (await sellerFitmentUploadVisible(page)) {
          throw new Error(
            "ACES upload is present; sheet marks invalid ACES rejection as Not Required.",
          );
        }
      },
    );
  });

  test("ODB-UC-106: seller uploads PIES file", async ({ page, soft }) => {
    await soft("ODB-UC-106", "PIES upload in seller catalog", async () => {
      await requireSellerFitment(page, "Upload PIES file");
    });
  });

  test("ODB-UC-107: invalid PIES file is rejected", async ({ page, soft }) => {
    await soft("ODB-UC-107", "Invalid PIES rejection in seller catalog", async () => {
      await requireSellerFitment(page, "Invalid PIES file rejection");
    });
  });

  test("ODB-UC-108: admin review of fitment is not required", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-108",
      "Admin fitment review absent (Not Required)",
      async () => {
        await gotoOneDirectBuy(page, "/vendor/dashboard");
        const review = page.getByText(
          /review fitment|approve fitment|fitment (approval|review)/i,
        );
        if (await review.first().isVisible({ timeout: 4_000 }).catch(() => false)) {
          throw new Error(
            "Admin fitment review is present; sheet marks this as Not Required.",
          );
        }
      },
    );
  });
});
