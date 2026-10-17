import { test, expect } from "../../fixtures/zukaTest.js";
import { ALLOW_ORDER_E2E, E2E_VENDOR, ADMIN_URL, STEP_TIMEOUT } from "../../helpers/zukaEnv.js";
import { api, orderSegment } from "../../helpers/zukaApi.js";
import { signIn } from "../../helpers/zukaAuth.js";
import {
  clearCart,
  walletBalance,
  customerOrders,
  customerOrder,
  openVendor,
  quickAdd,
  openTab,
  openTracking,
  setDeliveryLocation,
  openOrders,
} from "../../helpers/zukaCustomer.js";
import {
  openKitchenBoard,
  acceptOrder,
  declineOrder,
  markReady,
  waitForStaffOrder,
  openDeliveries,
  goOnline,
  goOffline,
  waitForDriverCard,
  uploadPod,
  waitForTicket,
  ticket,
  staffOrder,
} from "../../helpers/zukaPartner.js";

/**
 * Doc §3: customer → restaurant → driver → delivered, on the live site.
 * Pays with Zuka Credit (CO-08) so no card is needed. Each run creates real
 * orders on Burger House (the test kitchen's restaurant). Disable with
 * ZUKA_ALLOW_ORDER_E2E=0.
 */
test.describe.configure({ mode: "serial" });
test.skip(!ALLOW_ORDER_E2E, "ZUKA_ALLOW_ORDER_E2E=0 — live order lifecycle disabled");

const MIN_WALLET = 60;

/**
 * Keep the test customer's Zuka Credit above what a run spends, the same way
 * support does it: Admin → Customers → Credit.
 */
async function topUpWalletIfLow(rolePage, customerPage, soft, stepId) {
  await soft(stepId, `Zuka Credit is at least CI$${MIN_WALLET} (admin credits the wallet if low)`, async () => {
    const balance = await walletBalance(customerPage);
    if (balance >= MIN_WALLET) return;
    const admin = await rolePage("admin");
    await admin.goto(`${ADMIN_URL}/customers`, { waitUntil: "domcontentloaded" });
    await admin.getByRole("textbox", { name: "Search customers" }).fill("test-customer@zuka.test");
    const row = admin.locator("div").filter({ hasText: "test-customer@zuka.test" })
      .filter({ has: admin.getByRole("button", { name: /^Credit/ }) }).last();
    await expect(row).toBeVisible({ timeout: STEP_TIMEOUT });
    await row.getByRole("textbox", { name: "Wallet amount" }).fill("100");
    await row.getByRole("textbox", { name: "Wallet adjustment reason" }).fill("QA automation top-up");
    await row.getByRole("button", { name: /^Credit/ }).click();
    await expect.poll(() => walletBalance(customerPage), { timeout: 30_000 }).toBeGreaterThanOrEqual(MIN_WALLET);
  });
}

/**
 * Customer places a Burger House delivery order paid fully with Zuka Credit.
 * Returns the new order id ("#ZMV…").
 */
async function placeWalletOrder(page, soft, prefix, { pickup = false } = {}) {
  let orderId = "";
  await soft(`${prefix}-01`, "Customer sets a Grand Cayman pin, empties the cart and opens Burger House", async () => {
    await setDeliveryLocation(page);
    await clearCart(page);
    await openVendor(page, E2E_VENDOR.id, E2E_VENDOR.name);
    await expect(page.getByText("Open now").first()).toBeVisible();
  });
  await soft(`${prefix}-02`, "Customer adds Loaded fries and Iced coffee to the cart", async () => {
    await quickAdd(page, "Loaded fries");
    await quickAdd(page, "Iced coffee");
    await expect(page.getByRole("tab", { name: /^Cart, 2/ })).toBeVisible({ timeout: STEP_TIMEOUT });
  });
  await soft(`${prefix}-03`, `Cart shows Burger House with ${pickup ? "Pickup" : "Delivery"} selected`, async () => {
    await openTab(page, "Cart");
    await expect(page.getByRole("heading", { name: "Cart", level: 1 })).toBeVisible();
    await page.getByRole("radio", { name: pickup ? "Pickup" : "Delivery" }).click();
    await expect(page.getByText("Subtotal CI$15.50").or(page.getByText(/Subtotal\s*CI\$15\.50/)).first()).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
  });
  await soft(`${prefix}-04`, "Checkout → choose address → Payment Method", async () => {
    await page.getByRole("button", { name: /^Checkout( Burger House)?$/ }).first().click();
    if (pickup) {
      await expect(page.getByRole("heading", { name: "Pickup locations", level: 1 })).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByText(E2E_VENDOR.name).first()).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Delivery address", level: 1 })).toBeVisible({ timeout: STEP_TIMEOUT });
      await page.getByRole("radio", { name: /^Home, 18 Forum Lane, Camana Bay/ }).click();
    }
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await expect(page.getByRole("heading", { name: "Payment Method", level: 1 })).toBeVisible({ timeout: STEP_TIMEOUT });
  });
  const before = new Set((await customerOrders(page)).map((o) => o.id));
  await soft(`${prefix}-05`, "Customer pays with Zuka Wallet and places the order (CO-08)", async () => {
    await page.getByRole("radio", { name: /^Zuka Wallet/ }).click();
    const place = page.getByRole("button", { name: /^Place order/ });
    await place.click();
    // A review step may follow the method choice.
    const again = page.getByRole("button", { name: /^(Place order|Pay|Confirm)/ });
    await page.waitForTimeout(2_000);
    if (await again.first().isVisible().catch(() => false)) {
      await again.first().click().catch(() => {});
    }
    await expect
      .poll(async () => (await customerOrders(page)).filter((o) => !before.has(o.id)).length, {
        timeout: 45_000,
        message: "a new order appears in the customer's order list",
      })
      .toBeGreaterThan(0);
    const created = (await customerOrders(page)).filter((o) => !before.has(o.id));
    orderId = created[0].id;
    test.info().annotations.push({ type: "order", description: orderId });
    expect(created[0].vendorId).toBe(E2E_VENDOR.id);
    expect(created[0].paymentStatus).toBe("paid");
    expect(created[0].paymentProvider).toBe("wallet");
  });
  await soft(`${prefix}-06`, "'Order Confirmed!' shows the order number, then Orders → Active lists it", async () => {
    await expect(page.getByRole("heading", { name: "Order Confirmed!" })).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(page.getByText(`Your order ${orderId} has been placed successfully`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Track Order" })).toBeVisible();
    await openOrders(page, "Active");
    await expect(page.getByText(orderId).first()).toBeVisible({ timeout: STEP_TIMEOUT });
  });
  return orderId;
}

test.describe("ZUKAongo — order lifecycle (live)", () => {
  test("delivery order: customer → kitchen accepts → ready → driver picks up → PoD auto-delivers", async ({
    page,
    soft,
    rolePage,
  }) => {
    test.setTimeout(15 * 60_000);
    await signIn(page, "customer");
    await topUpWalletIfLow(rolePage, page, soft, "ZUKA-E2E-00");
    const walletBefore = await walletBalance(page);

    const orderId = await placeWalletOrder(page, soft, "ZUKA-E2E-D");

    await soft("ZUKA-E2E-D-07", "Zuka Credit is charged for the order total", async () => {
      const order = await customerOrder(page, orderId);
      const after = await walletBalance(page);
      expect(after).toBeCloseTo(walletBefore - Number(order.walletPaid ?? order.totalCents / 100), 1);
    });

    const kitchen = await rolePage("kitchen");
    await soft("ZUKA-E2E-D-08", "Kitchen (Burger House) sees the paid order on the kitchen board", async () => {
      await openKitchenBoard(kitchen);
      await waitForTicket(kitchen, orderId, /^Accept$/);
    });

    const driver = await rolePage("driver");
    await soft("ZUKA-E2E-D-09", "Driver goes online in the partner app", async () => {
      await openDeliveries(driver);
      await goOnline(driver);
    });

    await soft("ZUKA-E2E-D-10", "KI-01: kitchen accepts with 15 min → Preparing, readyBy ≈ now + 15m", async () => {
      const t0 = Date.now();
      await acceptOrder(kitchen, orderId, 15);
      const order = await waitForStaffOrder(kitchen, orderId, (o) => o.fulfillment === "preparing");
      expect(order.prepMins).toBe(15);
      if (order.readyBy) {
        const diffMin = (new Date(order.readyBy).getTime() - t0) / 60_000;
        expect(diffMin).toBeGreaterThan(13);
        expect(diffMin).toBeLessThan(17);
      }
    });

    await soft("ZUKA-E2E-D-11", "Customer tracking shows Preparing after the kitchen accepts", async () => {
      await openTracking(page, orderId);
      await expect(page.getByText(/Restaurant accepted|Preparing/).first()).toBeVisible({ timeout: STEP_TIMEOUT });
    });

    await soft("ZUKA-E2E-D-12", "Kitchen marks the order ready → Ready", async () => {
      await markReady(kitchen, orderId);
      await waitForStaffOrder(kitchen, orderId, (o) => o.fulfillment === "ready");
    });

    let driverCard;
    await soft("ZUKA-E2E-D-13", "Driver sees the ready order and claims / accepts it", async () => {
      await openDeliveries(driver);
      driverCard = await waitForDriverCard(driver, orderId, /^(Claim|Accept|Accept offer|Pick up|Picked up)/);
      const claim = driverCard.getByRole("button", { name: /^(Claim|Accept|Accept offer)/ });
      if (await claim.first().isVisible().catch(() => false)) await claim.first().click();
      await waitForStaffOrder(kitchen, orderId, (o) => Boolean(o.driverId || o.claimedAt || o.driverEmail));
    });

    await soft("ZUKA-E2E-D-14", "DR-03: a second driver claiming the same order gets a conflict", async () => {
      const driver2 = await rolePage("driver2");
      const res = await api(driver2, "POST", `/admin/orders/${orderSegment(orderId)}/claim`, {});
      expect(res.status, `claim by driver 2 → ${res.status} ${res.text}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    await soft("ZUKA-E2E-D-15", "DR-04: driver picks up → Out for delivery", async () => {
      const card = await waitForDriverCard(driver, orderId, /^(Pick up|Picked up|Mark picked up|Start delivery)/);
      await card.getByRole("button", { name: /^(Pick up|Picked up|Mark picked up|Start delivery)/ }).first().click();
      await waitForStaffOrder(kitchen, orderId, (o) => o.fulfillment === "out_for_delivery");
    });

    await soft("ZUKA-E2E-D-16", "Customer tracking shows On the way with the driver", async () => {
      await openTracking(page, orderId);
      await expect(page.getByText(/Picked up by driver|On the way|In Transit/).first()).toBeVisible({ timeout: STEP_TIMEOUT });
    });

    await soft("ZUKA-E2E-D-17", "DR-05: tapping Delivered without a photo asks for proof of delivery", async () => {
      const card = await waitForDriverCard(driver, orderId, /^Delivered$/);
      await card.getByRole("button", { name: /^Delivered$/ }).click();
      await expect(
        driver.getByText(/Upload proof of delivery before marking delivered|proof of delivery/i).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      const { order } = await staffOrder(kitchen, orderId);
      expect(order.fulfillment).toBe("out_for_delivery");
    });

    await soft("ZUKA-E2E-D-18", "DR-06: driver uploads the PoD photo → order becomes Delivered automatically", async () => {
      await openDeliveries(driver);
      const card = await waitForDriverCard(driver, orderId, /^Delivered$/);
      // "Upload PoD photo" opens the camera / file picker; it is not exposed as a button.
      await uploadPod(driver, card.getByText(/Upload PoD photo|Capture PoD/).first());
      const order = await waitForStaffOrder(kitchen, orderId, (o) => o.fulfillment === "delivered", 90_000);
      expect(order.deliveredAt).toBeTruthy();
    });

    await soft("ZUKA-E2E-D-19", "Customer sees Delivered with the delivery photo", async () => {
      await openTracking(page, orderId);
      await expect(page.getByText("Delivered").first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByText("Delivery photo")).toBeVisible({ timeout: STEP_TIMEOUT });
    });

    await soft("ZUKA-E2E-D-20", "Delivered is final: a further status change returns 409", async () => {
      const admin = await rolePage("admin");
      const res = await api(admin, "PATCH", `/admin/orders/${orderSegment(orderId)}`, { fulfillment: "preparing" });
      expect(res.status, `${res.status} ${res.text}`).toBe(409);
    });

    await soft("ZUKA-E2E-D-21", "Driver goes back offline", async () => {
      await openDeliveries(driver);
      await goOffline(driver);
    });
  });

  test("KI-02: kitchen declines a paid order (too busy) → cancelled and refunded to Zuka Credit", async ({
    page,
    soft,
    rolePage,
  }) => {
    test.setTimeout(10 * 60_000);
    await signIn(page, "customer");
    await topUpWalletIfLow(rolePage, page, soft, "ZUKA-E2E-X-00");
    const orderId = await placeWalletOrder(page, soft, "ZUKA-E2E-X");
    const walletAfterPay = await walletBalance(page);

    const kitchen = await rolePage("kitchen");
    await soft("ZUKA-E2E-X-07", "Kitchen declines with 'Kitchen too busy' (confirm disabled until a reason is picked)", async () => {
      await openKitchenBoard(kitchen);
      await declineOrder(kitchen, orderId, "Kitchen too busy");
      await waitForStaffOrder(kitchen, orderId, (o) => o.fulfillment === "cancelled");
    });

    await soft("ZUKA-E2E-X-08", "Paid order is refunded automatically to Zuka Credit", async () => {
      await expect
        .poll(async () => (await customerOrder(page, orderId))?.paymentStatus, { timeout: 45_000 })
        .toMatch(/refunded/);
      const order = await customerOrder(page, orderId);
      await expect.poll(() => walletBalance(page), { timeout: 30_000 }).toBeCloseTo(
        walletAfterPay + Number(order.walletPaid ?? order.totalCents / 100),
        1,
      );
    });

    await soft("ZUKA-E2E-X-09", "Customer sees the order under Cancelled", async () => {
      await openOrders(page, "Cancelled");
      await expect(page.getByText(orderId).first()).toBeVisible({ timeout: STEP_TIMEOUT });
    });

    await soft("ZUKA-E2E-X-10", "Kitchen cannot accept a cancelled order (409)", async () => {
      const res = await api(kitchen, "POST", `/admin/orders/${orderSegment(orderId)}/accept`, { prepMins: 15 });
      expect(res.status, `${res.status} ${res.text}`).toBe(409);
    });
  });

  test("CO-12: pickup order has no delivery fee and is handed over by the kitchen", async ({ page, soft, rolePage }) => {
    test.setTimeout(10 * 60_000);
    await signIn(page, "customer");
    await topUpWalletIfLow(rolePage, page, soft, "ZUKA-E2E-P-00");
    const orderId = await placeWalletOrder(page, soft, "ZUKA-E2E-P", { pickup: true });

    await soft("ZUKA-E2E-P-07", "Pickup order has delivery fee 0 and fulfillment mode pickup", async () => {
      const order = await customerOrder(page, orderId);
      expect(order.fulfillmentMode).toBe("pickup");
      expect(Number(order.deliveryFee || 0)).toBe(0);
    });

    const kitchen = await rolePage("kitchen");
    await soft("ZUKA-E2E-P-08", "Kitchen accepts (10 min) and marks ready", async () => {
      await openKitchenBoard(kitchen);
      await acceptOrder(kitchen, orderId, 10);
      await waitForStaffOrder(kitchen, orderId, (o) => o.fulfillment === "preparing");
      await markReady(kitchen, orderId);
      await waitForStaffOrder(kitchen, orderId, (o) => o.fulfillment === "ready");
    });

    await soft("ZUKA-E2E-P-09", "Pickup never goes to the driver pool", async () => {
      const driver = await rolePage("driver");
      const res = await api(driver, "GET", "/admin/orders?fulfillment=ready&page=1&pageSize=100");
      const ids = (res.json?.orders || []).map((o) => o.id);
      expect(ids).not.toContain(orderId);
    });

    await soft("ZUKA-E2E-P-10", "Kitchen marks the pickup order handed over → Delivered", async () => {
      const name = /^(Picked up|Handed over|Mark picked up|Complete|Delivered)/;
      await expect(ticket(kitchen, orderId, name)).toBeVisible({ timeout: STEP_TIMEOUT });
      await ticket(kitchen, orderId, name).getByRole("button", { name }).first().click();
      await waitForStaffOrder(kitchen, orderId, (o) => o.fulfillment === "delivered");
    });
  });
});
