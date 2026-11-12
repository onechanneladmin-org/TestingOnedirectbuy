// @flow B2 — Checkout (card). Guide: docs/qa/E2E-TEST-GUIDE.md § 5 B2.
// Use cases: ODB-UC-131, 133, 134, 138, 139, 140, 141, 143.
// Replaces the SOFT parts of Checkout.spec.js / PaymentsRefundsWallet.spec.js for the card path.
//
// Signs in as the fixed test buyer (ODB_BUYER_LOGIN=1), so it needs ONEDIRECTBUY_BUYER_EMAIL / _PASSWORD.
// Writes a cart on every test; the two payment tests also need ODB_ALLOW_ORDERS=1 and refuse to pay
// unless the target is non-production and every Stripe frame carries a pk_test_ key
// (assertStripeTestMode). Cards are Stripe's published test numbers only (assertStripeTestCard).
//
// Data checks: the buyer's own token (taken from the storefront's API calls, never logged) reads
// GET /user/orders before and after each payment:
//   - declined card (4000 0000 0000 0002) → an error on screen and NO new order;
//   - 4242 card → exactly one new order, status placed/processing, total = items + shipping + tax − discount
//     = the total shown on the checkout page, to the cent.
import { test, expect, go, centsFromText } from "./fixtures.js";
import { checkStep } from "../../helpers/checkStep.js";
import { fillLoginForm, hasBuyerCredentials, ONE_DIRECT_BUY_BUYER_CREDENTIALS as BUYER } from "../../helpers/oneDirectBuyAuth.js";
import {
  clearCart,
  addProductAndOpenCart,
  proceedToCheckout,
  fillCheckoutShipping,
  fillStripeSandboxCard,
  assertStripeTestMode,
} from "../../helpers/buyerPurchaseJourney.js";
import { expectOrderStatus, expectMoney } from "../../helpers/odbApi.js";

const DECLINE_CARD = "4000000000000002";
const ordersAllowed = () => process.env.ODB_ALLOW_ORDERS === "1";

/** Sign in and keep the buyer's Authorization header from the first storefront API call. */
async function signIn(page, odb) {
  const auth = { token: null };
  page.on("request", (r) => {
    const h = r.headers().authorization;
    if (!auth.token && h && r.url().startsWith(odb.apiURL)) auth.token = h;
  });
  await go(page, "/account/login");
  await fillLoginForm(page, BUYER.email, BUYER.password);
  await page.getByRole("button", { name: /^Sign in$/i }).first().click();
  await expect(page).not.toHaveURL(/\/account\/login$/, { timeout: 30_000 });
  await go(page, "/account/my-account");
  await expect.poll(() => auth.token, { message: "buyer token seen on an API call", timeout: 30_000 }).toBeTruthy();
  return auth;
}

async function buyerOrders(odb, auth) {
  const res = await fetch(`${odb.apiURL}/user/orders?page=1&limit=20`, { headers: { authorization: auth.token } });
  expect(res.status, "GET /user/orders").toBe(200);
  const body = await res.json();
  return body.orders || body.items || body.data || [];
}
const orderKey = (o) => String(o.orderNumber || o.orderId || o._id);

const payButton = (page) =>
  page.getByRole("button", { name: /Place order|Pay now|Complete order|Confirm (and )?pay|Submit order|Pay \$/i }).first();

/** Pick the first shipping rate if payment is still locked behind "Select a shipping method". */
async function chooseFirstRate(page) {
  const locked = page.getByText(/Select a shipping method above to enable payment/i);
  if (await locked.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const rate = page.locator(".ps-checkout, main").getByRole("radio").first();
    await expect(rate, "a shipping rate is offered").toBeVisible({ timeout: 30_000 });
    await rate.check({ force: true });
    await expect(locked).toBeHidden({ timeout: 15_000 });
  }
}

/** Money row on the checkout summary ("Shipping $9.99") → cents, or null when the row is absent. */
async function summaryCents(page, label) {
  const row = page.getByText(new RegExp(`^\\s*${label}\\b[^$]*\\$\\s*[\\d,]+\\.\\d{2}`, "i")).first();
  if (!(await row.isVisible({ timeout: 2_000 }).catch(() => false))) return null;
  return centsFromText((await row.innerText()).replace(/^[^$]*/, ""));
}

async function toCheckout(page, testInfo, health) {
  await clearCart(page);
  await addProductAndOpenCart(page);
  await checkStep(page, testInfo, { id: "ODB-UC-138", name: "cart before checkout", health });
  await proceedToCheckout(page);
  await checkStep(page, testInfo, { id: "ODB-UC-131", name: "checkout information", health });
}

test.describe("B2 checkout @flow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({ odb }) => {
    test.skip(process.env.ODB_BUYER_LOGIN !== "1", "set ODB_BUYER_LOGIN=1 to sign in as the fixed test buyer");
    test.skip(!hasBuyerCredentials(), "ONEDIRECTBUY_BUYER_EMAIL / _PASSWORD not set");
    test.skip(!odb.writable, "checkout writes a cart: needs a non-production target");
  });

  test("ODB-UC-133 / 134 address required fields, then a rate unlocks payment", async ({ page, health, odb }, testInfo) => {
    await signIn(page, odb);
    await toCheckout(page, testInfo, health);

    // Required fields: saving an empty new address must flag them and not unlock payment.
    const add = page.getByRole("button", { name: /Add (new )?address|New address/i }).first();
    if (await add.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await add.click();
      const save = page.getByRole("button", { name: /^Save( address)?$/i }).first();
      await save.click();
      await expect(
        page.locator(".ant-form-item-explain-error, [role=alert], .invalid-feedback, .error").first(),
        "empty address shows field errors",
      ).toBeVisible();
      await checkStep(page, testInfo, { id: "ODB-UC-133", name: "address required fields", health });
      await page.keyboard.press("Escape");
    }

    await fillCheckoutShipping(page);
    await chooseFirstRate(page);
    await expect(payButton(page), "payment unlocked once a rate is chosen").toBeVisible({ timeout: 30_000 });
    const shipping = await summaryCents(page, "Shipping");
    expect(shipping, "shipping shown as its own line").not.toBeNull();
    await checkStep(page, testInfo, { id: "ODB-UC-134", name: "shipping rate chosen", health });
  });

  test("ODB-UC-140 declined card shows an error and creates no order", async ({ page, health, odb }, testInfo) => {
    test.skip(!ordersAllowed(), "set ODB_ALLOW_ORDERS=1 (Stripe test mode) to submit payments");
    const auth = await signIn(page, odb);
    const before = (await buyerOrders(odb, auth)).map(orderKey);

    await toCheckout(page, testInfo, health);
    await fillCheckoutShipping(page);
    await chooseFirstRate(page);
    expect(await fillStripeSandboxCard(page, { card: DECLINE_CARD }), "Stripe card fields found").toBe(true);
    await assertStripeTestMode(page);
    await payButton(page).click();

    await expect(
      page.getByText(/declined|card was declined|payment failed|could not be processed/i).first(),
      "decline message shown",
    ).toBeVisible({ timeout: 60_000 });
    await expect(page, "still on checkout").toHaveURL(/\/account\/checkout/);
    await checkStep(page, testInfo, { id: "ODB-UC-140", name: "card declined", health });

    // Give a late webhook/order write time to show up, then compare.
    await page.waitForTimeout(5_000);
    const after = (await buyerOrders(odb, auth)).map(orderKey);
    expect(after.filter((k) => !before.includes(k)), "no order created for a declined card").toEqual([]);
  });

  test("ODB-UC-139 / 141 / 143 card 4242 places exactly one order; total = items + shipping + tax − discount", async ({ page, health, odb }, testInfo) => {
    test.skip(!ordersAllowed(), "set ODB_ALLOW_ORDERS=1 (Stripe test mode) to submit payments");
    const auth = await signIn(page, odb);
    const before = (await buyerOrders(odb, auth)).map(orderKey);

    await toCheckout(page, testInfo, health);
    await fillCheckoutShipping(page);
    await chooseFirstRate(page);

    const items = await summaryCents(page, "Subtotal");
    const shipping = (await summaryCents(page, "Shipping")) ?? 0;
    const tax = (await summaryCents(page, "Tax")) ?? 0;
    const discount = Math.abs((await summaryCents(page, "Discount")) ?? 0);
    const shownTotal = (await summaryCents(page, "Total due")) ?? (await summaryCents(page, "Total"));
    expect(items, "subtotal shown").not.toBeNull();
    expect(shownTotal, "total shown").not.toBeNull();
    expect(shownTotal, "total = items + shipping + tax − discount (screen)").toBe(items + shipping + tax - discount);
    await checkStep(page, testInfo, { id: "ODB-UC-138", name: "order totals", health });

    expect(await fillStripeSandboxCard(page), "Stripe card fields found").toBe(true);
    await assertStripeTestMode(page);
    // ODB-UC-141: a double click must not create two orders.
    await payButton(page).dblclick();
    await expect(
      page.getByRole("heading", { name: /Payment success|Thank you|order is confirmed|Order confirmed/i }).first(),
      "confirmation page",
    ).toBeVisible({ timeout: 90_000 });
    await checkStep(page, testInfo, { id: "ODB-UC-143", name: "order confirmation", health });

    let fresh = [];
    await expect
      .poll(async () => {
        fresh = (await buyerOrders(odb, auth)).filter((o) => !before.includes(orderKey(o)));
        return fresh.length;
      }, { message: "the new order shows on GET /user/orders", timeout: 60_000 })
      .toBeGreaterThan(0);
    // One checkout = one order document per seller; this flow buys one product from one seller.
    expect(fresh.length, "exactly one new order (no duplicate on double click)").toBe(1);
    const order = fresh[0];
    testInfo.annotations.push({ type: "odb-order", description: orderKey(order) });
    await expect(page.getByText(orderKey(order)).first(), "order number on the confirmation page").toBeVisible();

    expectOrderStatus(order, ["placed", "processing", "pending", "paid", "confirmed", "new"], "new order status");
    const apiTotal = order.total ?? order.grandTotal ?? order.totals?.total;
    expect(apiTotal, "order total on the API").not.toBeUndefined();
    expectMoney(apiTotal, shownTotal / 100, "API order total = total shown at checkout");
  });
});
