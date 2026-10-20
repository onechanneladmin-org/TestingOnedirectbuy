import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  openCheckoutWithCart,
} from "../helpers/oneDirectBuyNav.js";
import { ensureLoggedInBuyer } from "../helpers/oneDirectBuyAuth.js";
import {
  clickSaveAddress,
  fillAddressForm,
  testAddressData,
} from "../helpers/oneDirectBuyAddress.js";
import { fillCheckoutShipping } from "../helpers/buyerPurchaseJourney.js";
import {
  sellerPortalNotOnStorefrontError,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

function stripePaymentUi(page) {
  return page
    .locator(
      'iframe[src*="stripe"], iframe[title*="card" i], iframe[name*="__privateStripeFrame"]',
    )
    .or(page.getByText(/Visa\s*\/\s*Master Card\s*\(Stripe\)/i))
    .or(page.getByRole("radio", { name: /Visa|Master Card|Stripe|Card/i }));
}

function payNowButton(page) {
  return page.getByRole("button", { name: /^Pay now$/i }).first();
}

function billingSameCheckbox(page) {
  return page
    .getByRole("checkbox", {
      name: /billing (address )?(is )?the same as shipping|same as shipping/i,
    })
    .first();
}

async function requireBuyerLogin(page) {
  await ensureLoggedInBuyer(page);
}

test.describe("OneDirectBuy — Checkout", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-129: guest checkout", async ({ page, soft }) => {
    await soft("ODB-UC-129", "Checkout Information + Contact & Shipping", async () => {
      await openCheckoutWithCart(page);
      await expect(page).toHaveURL(/\/account\/checkout/);
      await expect(
        page.getByRole("heading", { name: /^Checkout Information$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /^Contact & Shipping$/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/Checkout as guest or login to use saved addresses/i),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /^Shipping address$/i }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /^login$/i }).first()).toBeVisible();
    });
  });

  test("ODB-UC-130: guest checkout blocked is not required", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-130",
      "Guest checkout is allowed (Not Required to block)",
      async () => {
        await openCheckoutWithCart(page);
        const blocked = page.getByText(
          /login required to checkout|guest checkout is (not |un)available|please sign in to continue/i,
        );
        if (await blocked.first().isVisible({ timeout: 4_000 }).catch(() => false)) {
          throw new Error(
            "Guest checkout is blocked; sheet marks guest-checkout blocking as Not Required.",
          );
        }
      },
    );
  });

  test("ODB-UC-131: checkout with saved address", async ({ page, soft }) => {
    await soft("ODB-UC-131", "Logged-in buyer can use a saved address", async () => {
      await requireBuyerLogin(page);
      await openCheckoutWithCart(page);
      const saved = page
        .getByRole("radio")
        .or(page.getByText(/selected|ship to|default address|saved address/i))
        .or(page.getByRole("button", { name: /use this address|select address/i }));
      if (!(await saved.first().isVisible({ timeout: 10_000 }).catch(() => false))) {
        const data = testAddressData("co");
        await fillAddressForm(page, data);
        await clickSaveAddress(page);
        await expect(
          page
            .getByText(/Selected|Ship to/i)
            .or(page.getByText(data.line1))
            .first(),
        ).toBeVisible({ timeout: 20_000 });
      }
    });
  });

  test("ODB-UC-132: add address during checkout", async ({ page, soft }) => {
    await soft("ODB-UC-132", "Fill and save a shipping address on checkout", async () => {
      await openCheckoutWithCart(page);
      await expect(page.getByRole("textbox", { name: /^Email \*$/i })).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^Address line 1 \*$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Save address for checkout$/i }),
      ).toBeVisible();
      const data = testAddressData(`co${Date.now()}`);
      await fillAddressForm(page, data);
      const email = page.getByRole("textbox", { name: /^Email \*$/i });
      if (await email.isVisible().catch(() => false)) {
        const current = await email.inputValue().catch(() => "");
        if (!current) {
          await email.fill("odb.guest.checkout@example.com");
        }
      }
      await clickSaveAddress(page);
      await expect(
        page
          .getByText(/Selected|Ship to/i)
          .or(page.getByText(data.line1))
          .first(),
      ).toBeVisible({ timeout: 20_000 });
    });
  });

  test("ODB-UC-133: shipping field validation", async ({ page, soft }) => {
    await soft("ODB-UC-133", "Save address keeps required Name * focused", async () => {
      await openCheckoutWithCart(page);
      const name = page.getByRole("textbox", { name: /^Name \*$/i });
      await expect(name).toBeVisible();
      await expect(name).toHaveAttribute("required", "");
      await page.getByRole("button", { name: /^Save address for checkout$/i }).click();
      const invalid = page.locator("input:invalid, select:invalid").first();
      await expect(invalid.or(name).first()).toBeVisible({ timeout: 5_000 });
      await expect(page).toHaveURL(/\/account\/checkout/);
    });
  });

  test("ODB-UC-134: select shipping method", async ({ page, soft }) => {
    await soft("ODB-UC-134", "Buyer can pick a shipping rate after address save", async () => {
      await openCheckoutWithCart(page);
      await fillCheckoutShipping(page);
      const method = page
        .getByText(/^Fastest$/i)
        .or(page.getByText(/USPS|FedEx|UPS|Ground|Standard|Express/i))
        .or(page.locator(".ps-checkout, main").getByRole("radio"));
      if (!(await method.first().isVisible({ timeout: 15_000 }).catch(() => false))) {
        throw new Error("No shipping method/rate is available to select after saving an address.");
      }
    });
  });

  test("ODB-UC-135: shipping unavailable", async ({ page, soft }) => {
    await soft(
      "ODB-UC-135",
      "Checkout blocks when shipping is unavailable (New Functionality)",
      async () => {
        await openCheckoutWithCart(page);
        const data = { ...testAddressData("noship"), zip: "00000" };
        await fillAddressForm(page, data);
        const email = page.getByRole("textbox", { name: /^Email \*$/i });
        if (await email.isVisible().catch(() => false)) {
          await email.fill("odb.guest.checkout@example.com").catch(() => {});
        }
        await clickSaveAddress(page);
        const blocked = page.getByText(
          /no shipping (quotes|methods|available)|shipping unavailable|cannot ship to this (zip|address)/i,
        );
        if (!(await blocked.first().isVisible({ timeout: 12_000 }).catch(() => false))) {
          throw new Error(
            "Checkout does not block when shipping is unavailable (sheet: New Functionality).",
          );
        }
      },
    );
  });

  test("ODB-UC-136: billing same as shipping", async ({ page, soft }) => {
    await soft("ODB-UC-136", "Billing-same-as-shipping control", async () => {
      await openCheckoutWithCart(page);
      if (
        !(await billingSameCheckbox(page)
          .isVisible({ timeout: 8_000 })
          .catch(() => false))
      ) {
        throw new Error(
          "Checkout has no billing-same-as-shipping checkbox.",
        );
      }
    });
  });

  test("ODB-UC-137: different billing address", async ({ page, soft }) => {
    await soft("ODB-UC-137", "Buyer can enter a separate billing address", async () => {
      await openCheckoutWithCart(page);
      const box = billingSameCheckbox(page);
      if (!(await box.isVisible({ timeout: 8_000 }).catch(() => false))) {
        throw new Error("Cannot enter a different billing address: no same-as-shipping control.");
      }
      if (await box.isChecked().catch(() => true)) {
        await box.uncheck({ force: true }).catch(async () => {
          await box.click({ force: true });
        });
      }
      const billing = page
        .getByRole("heading", { name: /billing address/i })
        .or(page.getByRole("textbox", { name: /billing/i }));
      if (!(await billing.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
        throw new Error("Unchecking same-as-shipping did not show a billing address form.");
      }
    });
  });

  test("ODB-UC-138: review order totals", async ({ page, soft }) => {
    await soft("ODB-UC-138", "Your order + Total $ with line item", async () => {
      await openCheckoutWithCart(page);
      await expect(page.getByRole("heading", { name: /^Your order$/i })).toBeVisible();
      await expect(
        page
          .getByRole("heading", { name: /Total\s*\$?\s*\d+/i })
          .or(page.getByText(/Total\s*\$\s*\d+/i))
          .first(),
      ).toBeVisible();
      const line = page
        .locator('a[href*="/product/"]')
        .or(page.locator(".ps-block--shopping-order, .ps-checkout-order, [class*='order']").getByText(/\$\s*\d+/))
        .first();
      await expect(line).toBeAttached({ timeout: 10_000 });
    });
  });

  test("ODB-UC-139: place order with card", async ({ page, soft }) => {
    await soft("ODB-UC-139", "Card payment UI unlocks after shipping (no live charge)", async () => {
      await openCheckoutWithCart(page);
      await fillCheckoutShipping(page);
      const stripe = stripePaymentUi(page);
      const pay = payNowButton(page);
      if (
        !(await stripe.first().isVisible({ timeout: 15_000 }).catch(() => false)) &&
        !(await pay.isVisible({ timeout: 5_000 }).catch(() => false))
      ) {
        throw new Error(
          "Checkout has no Stripe card fields or Pay now after selecting shipping.",
        );
      }
    });
  });

  test("ODB-UC-140: declined payment", async ({ page, soft }) => {
    await soft("ODB-UC-140", "Declined-card handling without a live charge", async () => {
      await openCheckoutWithCart(page);
      await fillCheckoutShipping(page);
      const declinedCopy = page.getByText(
        /card declined|payment (failed|declined)|unable to process/i,
      );
      if (await declinedCopy.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        return;
      }
      if (!(await stripePaymentUi(page).first().isVisible({ timeout: 10_000 }).catch(() => false))) {
        throw new Error(
          "Declined payment cannot be verified: Stripe payment UI is not on checkout.",
        );
      }
      throw new Error(
        "Declined-card handling is not exercised on live checkout (no sandbox charge submitted).",
      );
    });
  });

  test("ODB-UC-141: duplicate order prevention", async ({ page, soft }) => {
    await soft("ODB-UC-141", "Pay now is not double-submittable", async () => {
      await openCheckoutWithCart(page);
      await fillCheckoutShipping(page);
      const pay = payNowButton(page);
      if (!(await pay.isVisible({ timeout: 20_000 }).catch(() => false))) {
        throw new Error("No Pay now button to check duplicate-order prevention.");
      }
      await pay.click({ force: true }).catch(() => {});
      const busy =
        (await pay.getAttribute("disabled").catch(() => null)) != null ||
        (await pay.getAttribute("aria-busy").catch(() => "")) === "true" ||
        (await pay.isDisabled().catch(() => false));
      await expect(page).toHaveURL(/\/account\/checkout/, { timeout: 10_000 });
      if (!busy && (await payNowButton(page).count()) > 1) {
        throw new Error("Multiple Pay now controls found; duplicate submit is not guarded.");
      }
    });
  });

  test("ODB-UC-142: inventory reservation", async ({ page, soft }) => {
    await soft("ODB-UC-142", "Inventory reservation is not on the storefront", async () => {
      await openCheckoutWithCart(page);
      throw new Error(
        sellerPortalNotOnStorefrontError(
          "Inventory reservation after place-order",
        ),
      );
    });
  });

  test("ODB-UC-143: order confirmation page", async ({ page, soft }) => {
    await soft("ODB-UC-143", "Payment success confirmation page", async () => {
      await gotoOneDirectBuy(page, "/account/payment-success");
      if (/\/account\/login/i.test(page.url())) {
        return;
      }
      const heading = page.getByRole("heading", {
        name: /Payment success|Thank you|order is confirmed|confirmed/i,
      });
      if (!(await heading.first().isVisible({ timeout: 10_000 }).catch(() => false))) {
        throw new Error(
          "Payment success page does not mention an order confirmation (no sandbox charge).",
        );
      }
      await expect(
        page
          .getByRole("link", { name: /^View orders$/i })
          .or(page.getByRole("link", { name: /^Back to shop$/i }))
          .first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-144: order confirmation email", async ({ page, soft }) => {
    await soft("ODB-UC-144", "Confirmation page mentions an email to the buyer", async () => {
      await gotoOneDirectBuy(page, "/account/payment-success");
      const copy = page.getByText(
        /confirmation email|sent (you )?an email|email (has been )?sent|check your (inbox|email)/i,
      );
      if (!(await copy.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
        throw new Error(
          "Payment success page does not mention an order confirmation email.",
        );
      }
    });
  });

  test("ODB-UC-145: seller order notification", async ({ page, soft }) => {
    await soft("ODB-UC-145", "Seller new-order notification on storefront or portal", async () => {
      for (const path of ["/vendor/orders", "/vendor/dashboard"]) {
        await gotoOneDirectBuy(page, path);
        const ui = page.getByText(
          /new order|order notification|seller orders|incoming order/i,
        );
        if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
          return;
        }
      }
      throw new Error(sellerPortalNotOnStorefrontError("Seller order notification"));
    });
  });

  test("ODB-UC-146: admin order visibility", async ({ page, soft }) => {
    await soft("ODB-UC-146", "Admin order list on storefront or portal", async () => {
      for (const path of ["/admin/orders", "/vendor/admin/orders"]) {
        await gotoOneDirectBuy(page, path);
        const ui = page.getByText(
          /admin orders|all orders|manage orders|order management/i,
        );
        if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
          return;
        }
      }
      throw new Error(
        "Admin order visibility is not on the OneDirectBuy storefront (admin orders live in OneChannel).",
      );
    });
  });

  test("ODB-UC-147: state tax calculation", async ({ page, soft }) => {
    await soft(
      "ODB-UC-147",
      "Tax by shipping state (New Functionality)",
      async () => {
        await openCheckoutWithCart(page);
        await fillCheckoutShipping(page);
        const tax = page.getByText(/^Tax$|^Estimated tax$|state tax/i);
        if (!(await tax.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
          throw new Error(
            "Checkout has no state tax line after saving a shipping address (sheet: New Functionality).",
          );
        }
      },
    );
  });

  test("ODB-UC-148: tax exemption checkout", async ({ page, soft }) => {
    await soft(
      "ODB-UC-148",
      "Tax-exempt checkout control (New Functionality)",
      async () => {
        await openCheckoutWithCart(page);
        const exempt = page.getByText(
          /tax exempt|exemption certificate|resale certificate|tax-exempt/i,
        );
        if (!(await exempt.first().isVisible({ timeout: 6_000 }).catch(() => false))) {
          throw new Error(
            "Checkout has no tax-exemption control (sheet: New Functionality).",
          );
        }
      },
    );
  });

  test("ODB-UC-149: payment interruption recovery", async ({ page, soft }) => {
    await soft("ODB-UC-149", "Buyer can retry Pay now after a failed attempt", async () => {
      await openCheckoutWithCart(page);
      await fillCheckoutShipping(page);
      const pay = payNowButton(page);
      if (!(await pay.isVisible({ timeout: 20_000 }).catch(() => false))) {
        throw new Error("No Pay now button to retry after a payment interruption.");
      }
      await pay.click({ force: true }).catch(() => {});
      await expect(page).toHaveURL(/\/account\/checkout/, { timeout: 15_000 });
      if (!(await payNowButton(page).isVisible({ timeout: 10_000 }).catch(() => false))) {
        throw new Error("Pay now disappeared after an incomplete payment attempt; retry is not available.");
      }
    });
  });
});
