import { test, expect } from "../helpers/softTest.js";
import { openCheckoutWithCart } from "../helpers/oneDirectBuyNav.js";
import {
  ensureLoggedInBuyer,
  hasBuyerCredentials,
  expectGuestRedirectToLogin,
} from "../helpers/oneDirectBuyAuth.js";
import {
  addShippingAddress,
  addressCardByLabel,
  clickSaveAddress,
  deleteAddressByLabel,
  dismissAddressDialogs,
  expectGuestAddressesRedirect,
  fillAddressForm,
  openAddressesPage,
  openEditAddress,
  testAddressData,
} from "../helpers/oneDirectBuyAddress.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Buyer Addresses (guest)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-015: guest visiting addresses redirects to login", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-015-addresses", "/account/addresses → Welcome back", async () => {
      await expectGuestAddressesRedirect(page);
    });
  });

  test("ODB-UC-015: guest visiting add-address redirects to login", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-015-add-address", "/account/addresses/add → login", async () => {
      await expectGuestRedirectToLogin(page, "/account/addresses/add");
    });
  });

  test("ODB-UC-132-addr: checkout exposes live address field labels", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-132-addr",
      "Name / Address line 1 / Country / default checkbox",
      async () => {
        await openCheckoutWithCart(page);
        await expect(page.getByRole("textbox", { name: /^Name \*$/i })).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: /^Address line 1 \*$/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("combobox", { name: /^Country \*$/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: /^Zip \/ Postal code \*$/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("checkbox", { name: /^Set as default address$/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: /^Label$/i }),
        ).toBeVisible();
      },
    );
  });
});

test.describe("OneDirectBuy — Buyer Addresses (authenticated)", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-010: buyer adds new shipping address", async ({ page, soft }) => {
    await soft("ODB-UC-010", "Add address via /account/addresses/add", async () => {
      const address = testAddressData("add");
      await addShippingAddress(page, address);
      await expect(addressCardByLabel(page, address.label)).toBeVisible();
    });
  });

  test("ODB-UC-011: buyer edits saved shipping address", async ({ page, soft }) => {
    await soft("ODB-UC-011", "Edit address → update city → Save", async () => {
      const address = testAddressData("edit");
      await addShippingAddress(page, address);
      await dismissAddressDialogs(page);

      // Must click the pencil "Edit address" on THIS card — not "Set default".
      await openEditAddress(page, address.label);

      const updatedCity = "Springfield";
      await fillAddressForm(page, { ...address, city: updatedCity });
      await clickSaveAddress(page);
      await dismissAddressDialogs(page);

      await openAddressesPage(page);
      await dismissAddressDialogs(page);
      const card = addressCardByLabel(page, address.label);
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card.getByText(new RegExp(updatedCity, "i")).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test("ODB-UC-013: buyer sets one address as default", async ({ page, soft }) => {
    await soft("ODB-UC-013", "Set default / Default badge", async () => {
      const first = testAddressData("default-a");
      await addShippingAddress(page, first);

      await openAddressesPage(page);
      await dismissAddressDialogs(page);
      const defaultMark = page
        .getByText(/^Default$/i)
        .or(page.getByText(/default address/i))
        .or(page.getByRole("checkbox", { name: /Set as default address/i }))
        .or(page.locator(".account-addresses__badge--default"));
      await expect(defaultMark.first()).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-012: buyer deletes saved shipping address", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-012", "Delete address removes line1 from list", async () => {
      const address = testAddressData("delete");
      await addShippingAddress(page, address);
      await dismissAddressDialogs(page);
      await deleteAddressByLabel(page, address.label);
    });
  });
});
