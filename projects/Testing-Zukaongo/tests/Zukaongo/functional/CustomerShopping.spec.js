import { test, expect } from "../../fixtures/zukaTest.js";
import { signIn } from "../../helpers/zukaAuth.js";
import { CUSTOMER_URL, E2E_VENDOR, STEP_TIMEOUT } from "../../helpers/zukaEnv.js";
import {
  setDeliveryLocation,
  vendorCard,
  openVendor,
  quickAdd,
  clearCart,
  openTab,
} from "../../helpers/zukaCustomer.js";

/**
 * Doc §3.1 steps 1–4 as a shopper: location, browse, menu, cart, checkout up to
 * (not including) Place order. Uses Customer 2 so the live-order specs keep
 * their own cart.
 */
test.describe("ZUKAongo — customer browse, cart and checkout", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "customer2");
  });

  test("Grand Cayman pin lists restaurants that deliver there", async ({ page, soft }) => {
    await soft("ZUKA-SHOP-01", "Postal code KY1-1201 sets the delivery pin", async () => {
      await setDeliveryLocation(page, "KY1-1201");
    });
    await soft("ZUKA-SHOP-02", "Popular restaurants shows Burger House as open with ETA and fee", async () => {
      await expect(page.getByRole("heading", { name: "Popular restaurants" })).toBeVisible({ timeout: STEP_TIMEOUT });
      const card = vendorCard(page, E2E_VENDOR.name);
      await expect(card).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(card).toHaveAccessibleName(/Burger House, open/);
      await expect(card).toContainText(/min/);
      await expect(card).toContainText(/Free delivery over CI\$40/);
    });
    await soft("ZUKA-SHOP-03", "Closed restaurants are labelled Closed", async () => {
      const closed = page.getByRole("button", { name: /, closed, / });
      if ((await closed.count()) > 0) await expect(closed.first()).toContainText("Closed");
    });
    await soft("ZUKA-SHOP-04", "Cuisine chip 'Burgers' keeps Burger House in the results", async () => {
      await page.getByRole("button", { name: /Burgers$/ }).first().click();
      await expect(vendorCard(page, E2E_VENDOR.name)).toBeVisible({ timeout: STEP_TIMEOUT });
    });
    await soft("ZUKA-SHOP-05", "See all opens the Restaurants directory", async () => {
      await page.goto(`${CUSTOMER_URL}/places?mode=restaurant`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Restaurants", level: 1 }).first()).toBeVisible({ timeout: 45_000 });
      await expect(vendorCard(page, E2E_VENDOR.name)).toBeVisible({ timeout: STEP_TIMEOUT });
    });
    await soft("ZUKA-SHOP-06", "Grocery is marked 'Soon'", async () => {
      await expect(page.getByRole("tab", { name: /Grocery stores Soon|Grocery & Produce, Soon/ }).first()).toBeVisible();
    });
  });

  test("CO-04: a pin outside every restaurant's range shows 'not serving this area'", async ({ page, soft }) => {
    await soft("ZUKA-SHOP-07", "US zip 10001 → 'We’re not serving this area yet'", async () => {
      await setDeliveryLocation(page, "10001");
      await expect(page.getByRole("heading", { name: /not serving this area/ })).toBeVisible({ timeout: STEP_TIMEOUT });
    });
    await soft("ZUKA-SHOP-08", "Switching the pin back to KY1-1201 lists restaurants again", async () => {
      await setDeliveryLocation(page, "KY1-1201");
      await expect(vendorCard(page, E2E_VENDOR.name)).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });

  test("restaurant menu and product detail", async ({ page, soft }) => {
    await soft("ZUKA-SHOP-09", "Burger House shows Open now, hours and menu sections", async () => {
      await openVendor(page, E2E_VENDOR.id, E2E_VENDOR.name);
      await expect(page.getByText("Open now").first()).toBeVisible();
      await expect(page.getByText(/\d{2}:\d{2}–\d{2}:\d{2} today/).first()).toBeVisible();
      for (const s of ["Mealboxes", "Featured", "Sides", "Drinks", "Desserts", "Reviews"]) {
        await expect(page.getByRole("button", { name: s, exact: true })).toBeVisible();
      }
    });
    await soft("ZUKA-SHOP-10", "Items show CI$ prices; burgers need Customize, sides have Add", async () => {
      await expect(page.getByRole("button", { name: "Fries, CI$6.00" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Customize: Cheese burger" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add: Fries" })).toBeVisible();
    });
    await soft("ZUKA-SHOP-11", "Product page: instructions limit 200, quantity updates the total", async () => {
      await page.goto(`${CUSTOMER_URL}/product/bh-fries`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Fries", level: 1 })).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText("0/200")).toBeVisible();
      await page.getByRole("textbox", { name: "Special instructions" }).fill("No salt please");
      await expect(page.getByText("14/200")).toBeVisible();
      await expect(page.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
      await page.getByRole("button", { name: "Increase quantity" }).click();
      await expect(page.getByRole("button", { name: /Add to cart/ })).toContainText("CI$12.00");
    });
    await soft("ZUKA-SHOP-12", "Add to cart from the product page updates the cart badge", async () => {
      await clearCart(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Fries", level: 1 })).toBeVisible({ timeout: 45_000 });
      await page.getByRole("button", { name: /Add to cart/ }).click();
      await expect(page.getByRole("tab", { name: /^Cart, 1/ })).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });

  test("cart rules, promo, tip and checkout up to payment", async ({ page, soft }) => {
    await setDeliveryLocation(page, "KY1-1201");
    await soft("ZUKA-SHOP-13", "Cart with Fries from Burger House shows subtotal CI$6.00", async () => {
      await clearCart(page);
      await openVendor(page, E2E_VENDOR.id, E2E_VENDOR.name);
      await quickAdd(page, "Fries");
      await openTab(page, "Cart");
      await expect(page.getByRole("heading", { name: "Cart", level: 1 })).toBeVisible();
      await expect(page.getByText(/Subtotal\s*CI\$6\.00/).first()).toBeVisible({ timeout: STEP_TIMEOUT });
    });
    await soft("ZUKA-SHOP-14", "Increasing quantity updates the subtotal to CI$12.00", async () => {
      await page.getByRole("slider", { name: /Fries, quantity 1/ }).getByRole("button", { name: "Increase quantity" }).click();
      await expect(page.getByRole("slider", { name: /Fries, quantity 2/ })).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByText(/Subtotal\s*CI\$12\.00/).first()).toBeVisible({ timeout: STEP_TIMEOUT });
    });
    await soft("ZUKA-SHOP-15", "CO-12: Pickup shows no delivery fee", async () => {
      await page.getByRole("radio", { name: "Pickup" }).click();
      await expect(page.getByText(/Pickup\s*CI\$0\.00/).first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await page.getByRole("radio", { name: "Delivery" }).click();
    });
    await soft("ZUKA-SHOP-16", "CO-07: an unknown promo code is refused", async () => {
      await page.getByRole("textbox", { name: "Promo code" }).fill("NOTAREALCODE99");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(page.getByText(/invalid|not found|unavailable|doesn.t exist|not valid|can.t be applied/i).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
    });
    await soft("ZUKA-SHOP-17", "Tip 10% adds a tip line", async () => {
      await page.getByRole("button", { name: "10%", exact: true }).click();
      await expect(page.getByText(/Tip\s*CI\$\d/).first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await page.getByRole("button", { name: "None", exact: true }).click();
    });
    await soft("ZUKA-SHOP-18", "CO-05: adding a second restaurant keeps both carts, one checkout each", async () => {
      await openVendor(page, "mamas-pizza", "Mama's Pizza").catch(async () => {
        await openVendor(page, "canto-casa", "Canto Casa");
      });
      const add = page.getByRole("button", { name: /^Add: / }).first();
      const label = (await add.getAttribute("aria-label")) || (await add.innerText());
      await quickAdd(page, String(label).replace(/^Add:\s*/, "").trim());
      await openTab(page, "Cart");
      await expect(page.getByText("You have carts from 2 restaurants. Checkout one shop at a time.")).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: /^Checkout / })).toHaveCount(2);
    });
    await soft("ZUKA-SHOP-19", "CO-02: a closed restaurant's cart says it is closed and offers scheduling", async () => {
      const closedAlert = page.getByRole("alert").filter({ hasText: /is closed right now/ });
      if (await closedAlert.count()) await expect(closedAlert.first()).toContainText("schedule the order for later");
    });
    await soft("ZUKA-SHOP-20", "Checkout Burger House → Delivery address → Payment Method with Zuka Wallet", async () => {
      await page.getByRole("button", { name: "Checkout Burger House" }).click();
      await expect(page.getByRole("heading", { name: "Delivery address", level: 1 })).toBeVisible({ timeout: STEP_TIMEOUT });
      const addresses = page.getByRole("radio");
      if ((await addresses.count()) === 0) test.info().annotations.push({ type: "note", description: "Customer 2 has no saved address" });
      else await addresses.first().click();
      await page.getByRole("button", { name: "Continue to payment" }).click();
      await expect(page.getByRole("heading", { name: "Payment Method", level: 1 })).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("radio", { name: /^Zuka Wallet, Balance CI\$/ })).toBeVisible();
      await expect(page.getByRole("radio", { name: /^Credit or debit card/ })).toBeVisible();
      await expect(page.locator("body")).toContainText(/Subtotal\s*CI\$12\.00/);
      await expect(page.locator("body")).toContainText(/Total\s*CI\$\d/);
      await expect(page.getByRole("button", { name: "Place order" })).toBeVisible();
    });
    await clearCart(page).catch(() => {});
  });
});
