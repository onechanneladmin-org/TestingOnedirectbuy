import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  openCheckoutWithCart,
} from "../helpers/oneDirectBuyNav.js";
import { ensureLoggedInBuyer } from "../helpers/oneDirectBuyAuth.js";
import { fillCheckoutShipping } from "../helpers/buyerPurchaseJourney.js";
import { sellerPortalNotOnStorefrontError } from "../helpers/oneDirectBuySeller.js";

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

async function requireBuyerLogin(page) {
  await ensureLoggedInBuyer(page);
}

async function openPaidCheckout(page) {
  await openCheckoutWithCart(page);
  await fillCheckoutShipping(page);
}

async function pathHasText(page, paths, pattern) {
  for (const path of paths) {
    await gotoOneDirectBuy(page, path);
    const ui = page.getByText(pattern);
    if (await ui.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

test.describe("OneDirectBuy — Payments (buyer checkout)", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-150: credit card payment", async ({ page, soft }) => {
    await soft("ODB-UC-150", "Stripe card UI + Pay now (no live charge)", async () => {
      await openPaidCheckout(page);
      const stripe = stripePaymentUi(page);
      const pay = payNowButton(page);
      if (
        !(await stripe.first().isVisible({ timeout: 15_000 }).catch(() => false)) &&
        !(await pay.isVisible({ timeout: 5_000 }).catch(() => false))
      ) {
        throw new Error(
          "Checkout has no credit-card / Stripe payment UI after selecting shipping.",
        );
      }
    });
  });

  test("ODB-UC-151: payment failure handling", async ({ page, soft }) => {
    await soft("ODB-UC-151", "Failed payment is shown without completing an order", async () => {
      await openPaidCheckout(page);
      const pay = payNowButton(page);
      if (await pay.isVisible({ timeout: 15_000 }).catch(() => false)) {
        await pay.click({ force: true }).catch(() => {});
      }
      const failed = page.getByText(
        /payment (failed|declined)|unable to process|card (was )?declined|enter (a )?valid card/i,
      );
      if (await failed.first().isVisible({ timeout: 8_000 }).catch(() => false)) {
        return;
      }
      if (!(await stripePaymentUi(page).first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        throw new Error("Payment failure handling cannot be verified: no Stripe UI on checkout.");
      }
      throw new Error(
        "Failed-payment messaging is not shown without submitting a live charge.",
      );
    });
  });

  test("ODB-UC-152: payment timeout handling", async ({ page, soft }) => {
    await soft("ODB-UC-152", "Timeout copy or order left incomplete", async () => {
      await openPaidCheckout(page);
      const timeout = page.getByText(
        /payment timed? out|session (has )?expired|try again later|timeout/i,
      );
      if (await timeout.first().isVisible({ timeout: 4_000 }).catch(() => false)) {
        return;
      }
      await expect(page).toHaveURL(/\/account\/checkout/);
      if (!(await payNowButton(page).isVisible({ timeout: 10_000 }).catch(() => false))) {
        throw new Error(
          "Payment timeout handling is missing: checkout left Pay now unavailable.",
        );
      }
      throw new Error(
        "Payment timeout handling is not observable on live checkout (sheet: Working, no sandbox timeout).",
      );
    });
  });

  test("ODB-UC-153: retry failed payment", async ({ page, soft }) => {
    await soft("ODB-UC-153", "Pay now remains available after an incomplete attempt", async () => {
      await openPaidCheckout(page);
      const pay = payNowButton(page);
      if (!(await pay.isVisible({ timeout: 20_000 }).catch(() => false))) {
        throw new Error("No Pay now button to retry a failed payment.");
      }
      await pay.click({ force: true }).catch(() => {});
      await expect(page).toHaveURL(/\/account\/checkout/, { timeout: 15_000 });
      if (!(await payNowButton(page).isVisible({ timeout: 10_000 }).catch(() => false))) {
        throw new Error("Pay now disappeared after an incomplete payment; retry is not available.");
      }
    });
  });
});

test.describe("OneDirectBuy — Admin refunds, webhooks, wallet, store credit", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-154: admin view transaction", async ({ page, soft }) => {
    await soft("ODB-UC-154", "Admin transaction list (New Functionality)", async () => {
      if (
        await pathHasText(page, ["/admin/payments", "/admin/transactions", "/vendor/payments"], /transaction|payment (id|intent)|stripe (charge|payout)/i)
      ) {
        return;
      }
      throw new Error(
        "Admin payment transactions are not on the storefront (sheet: New Functionality).",
      );
    });
  });

  test("ODB-UC-155: admin full refund", async ({ page, soft }) => {
    await soft("ODB-UC-155", "Full refund control (New Functionality)", async () => {
      if (
        await pathHasText(page, ["/admin/refunds", "/vendor/refunds", "/admin/orders"], /full refund|issue refund|refund order/i)
      ) {
        return;
      }
      throw new Error(
        sellerPortalNotOnStorefrontError("Admin full refund"),
      );
    });
  });

  test("ODB-UC-156: admin partial refund", async ({ page, soft }) => {
    await soft("ODB-UC-156", "Partial refund control (New Functionality)", async () => {
      if (
        await pathHasText(page, ["/admin/refunds", "/vendor/refunds"], /partial refund|refund amount/i)
      ) {
        return;
      }
      throw new Error(
        "Partial refund is not on the OneDirectBuy storefront (sheet: New Functionality).",
      );
    });
  });

  test("ODB-UC-157: refund amount validation", async ({ page, soft }) => {
    await soft("ODB-UC-157", "Invalid refund amount blocked (New Functionality)", async () => {
      if (
        await pathHasText(page, ["/admin/refunds", "/vendor/refunds"], /refund (amount|exceeds|invalid)|cannot refund/i)
      ) {
        return;
      }
      throw new Error(
        "Refund amount validation is not on the storefront (sheet: New Functionality).",
      );
    });
  });

  test("ODB-UC-158: payment webhook success", async ({ page, soft }) => {
    await soft("ODB-UC-158", "Payment webhook success (New Functionality)", async () => {
      throw new Error(
        "Payment webhook success is not a storefront flow (sheet: New Functionality).",
      );
    });
  });

  test("ODB-UC-159: failed webhook retry", async ({ page, soft }) => {
    await soft("ODB-UC-159", "Failed webhook retry (New Functionality)", async () => {
      throw new Error(
        "Failed payment webhook retry is not a storefront flow (sheet: New Functionality).",
      );
    });
  });

  test("ODB-UC-160: save payment method", async ({ page, soft }) => {
    await soft("ODB-UC-160", "Wallet save-card UI (New Functionality)", async () => {
      await requireBuyerLogin(page);
      if (
        await pathHasText(
          page,
          ["/account/payment-methods", "/account/wallet", "/account/cards"],
          /save (this )?(card|payment method)|add (a )?(card|payment method)|payment methods/i,
        )
      ) {
        return;
      }
      await openCheckoutWithCart(page);
      const saveCard = page.getByText(/save (this )?(card|payment method)|remember this card/i);
      if (await saveCard.first().isVisible({ timeout: 6_000 }).catch(() => false)) {
        return;
      }
      throw new Error(
        "Save payment method is not on account or checkout (sheet: New Functionality).",
      );
    });
  });

  test("ODB-UC-161: use saved payment method", async ({ page, soft }) => {
    await soft("ODB-UC-161", "Pay with saved card (New Functionality)", async () => {
      await requireBuyerLogin(page);
      await openPaidCheckout(page);
      const saved = page.getByText(
        /saved (card|payment method)|use (saved|this) card|ending in \d{4}/i,
      );
      if (!(await saved.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
        throw new Error(
          "Checkout has no saved payment method to use (sheet: New Functionality).",
        );
      }
    });
  });

  test("ODB-UC-162: delete payment method", async ({ page, soft }) => {
    await soft("ODB-UC-162", "Remove saved card (New Functionality)", async () => {
      await requireBuyerLogin(page);
      if (
        await pathHasText(
          page,
          ["/account/payment-methods", "/account/wallet", "/account/cards"],
          /delete (card|payment method)|remove (card|payment method)/i,
        )
      ) {
        return;
      }
      throw new Error(
        "Delete payment method is not on the storefront (sheet: New Functionality).",
      );
    });
  });

  test("ODB-UC-163: set default payment method", async ({ page, soft }) => {
    await soft("ODB-UC-163", "Default saved card (New Functionality)", async () => {
      await requireBuyerLogin(page);
      if (
        await pathHasText(
          page,
          ["/account/payment-methods", "/account/wallet", "/account/cards"],
          /set as default|default (card|payment method)/i,
        )
      ) {
        return;
      }
      throw new Error(
        "Set default payment method is not on the storefront (sheet: New Functionality).",
      );
    });
  });

  test("ODB-UC-164: issue store credit", async ({ page, soft }) => {
    await soft("ODB-UC-164", "Admin issue store credit (New Functionality)", async () => {
      if (
        await pathHasText(
          page,
          ["/admin/store-credit", "/admin/wallet", "/vendor/store-credit"],
          /issue (store )?credit|grant credit|store credit/i,
        )
      ) {
        return;
      }
      throw new Error(
        "Admin issue store credit is not on the storefront (sheet: New Functionality).",
      );
    });
  });

  test("ODB-UC-165: apply store credit", async ({ page, soft }) => {
    await soft("ODB-UC-165", "Buyer applies store credit at checkout (New Functionality)", async () => {
      await openCheckoutWithCart(page);
      const credit = page.getByText(
        /store credit|apply credit|account credit|wallet balance/i,
      );
      if (!(await credit.first().isVisible({ timeout: 6_000 }).catch(() => false))) {
        throw new Error(
          "Checkout has no store-credit apply control (sheet: New Functionality).",
        );
      }
    });
  });

  test("ODB-UC-166: partial credit payment", async ({ page, soft }) => {
    await soft("ODB-UC-166", "Pay remaining balance after store credit (New Functionality)", async () => {
      await openCheckoutWithCart(page);
      const partial = page.getByText(
        /remaining (balance|to pay)|pay the difference|partial (store )?credit/i,
      );
      if (!(await partial.first().isVisible({ timeout: 6_000 }).catch(() => false))) {
        throw new Error(
          "Checkout has no partial store-credit payment (sheet: New Functionality).",
        );
      }
    });
  });
});
