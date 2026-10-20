import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

test("Rentals Order Flow", async ({ page }) => {
  await loginOneChannelAdmin(page);

  // Wait for login to complete
  await page.waitForURL(/dashboard|home|fulfill/, { timeout: 15000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  // Step 4: Navigate to Fulfillment > Rentals
  const fulfillmentButton = page.getByRole("button", { name: "Fulfillment" });
  await expect(fulfillmentButton).toBeVisible({ timeout: 10000 });
  await fulfillmentButton.click();
  await page.waitForTimeout(500);

  const rentalsLink = page.getByRole("link", { name: "Rentals" });
  await expect(rentalsLink).toBeVisible({ timeout: 5000 });
  await rentalsLink.click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  // Step 5: Click Rental Order button
  const rentalOrderButton = page.getByRole("button", { name: "Rental Order" });
  await expect(rentalOrderButton).toBeVisible({ timeout: 10000 });
  await rentalOrderButton.click();
  await page.waitForTimeout(500);

  // Step 6: Click Create Order
  const createOrderButton = page.getByText("Create Order");
  await expect(createOrderButton).toBeVisible({ timeout: 10000 });
  await createOrderButton.click();
  await page.waitForTimeout(500);

  // Step 7: Select Walk-In Order
  const walkInOrderText = page.getByText("Walk-In OrderCustomer is");
  await expect(walkInOrderText).toBeVisible({ timeout: 10000 });
  await walkInOrderText.click();
  await page.waitForTimeout(300);

  const walkInOrderOption = page.getByText("Walk-In Order").first();
  await expect(walkInOrderOption).toBeVisible({ timeout: 5000 });
  await walkInOrderOption.click();
  await page.waitForTimeout(500);

  // Step 8: Click Continue
  const continueButton1 = page
    .locator("div")
    .filter({ hasText: /^Continue$/ })
    .first();
  await expect(continueButton1).toBeVisible({ timeout: 10000 });
  await continueButton1.click();
  await page.waitForTimeout(1000);

  // Step 9: Fill customer information
  const fullNameInput = page.getByRole("textbox", { name: "Enter full name" });
  await expect(fullNameInput).toBeVisible({ timeout: 10000 });
  await fullNameInput.click();
  await fullNameInput.fill("Anurag");
  await page.waitForTimeout(300);

  const emailInput2 = page.getByRole("textbox", {
    name: "john.smith@example.com",
  });
  await expect(emailInput2).toBeVisible({ timeout: 10000 });
  await emailInput2.click();
  await emailInput2.fill("admin@onechanneladmin.com");
  await page.waitForTimeout(300);

  const addressInput = page.getByRole("textbox", {
    name: "Medical Center Drive, Suite 100",
  });
  await expect(addressInput).toBeVisible({ timeout: 10000 });
  await addressInput.click();
  await addressInput.fill("Texas , Usa");
  await page.waitForTimeout(300);

  // Step 10: Select date
  const dateText = page.getByText("15/06/");
  if (await dateText.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dateText.click();
    await page.waitForTimeout(500);

    const confirmButton = page
      .locator("div")
      .filter({ hasText: /^Confirm$/ })
      .first();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();
    await page.waitForTimeout(500);
  }

  // Step 11: Fill weight
  const weightInput = page.getByRole("textbox", { name: "lbs" });
  await expect(weightInput).toBeVisible({ timeout: 10000 });
  await weightInput.click();
  await weightInput.fill("180");
  await page.waitForTimeout(300);

  // Step 12: Fill relationship
  const relationshipInput = page.getByRole("textbox", {
    name: "Self (Patient)",
  });
  await expect(relationshipInput).toBeVisible({ timeout: 10000 });
  await relationshipInput.click();
  await page.waitForTimeout(500);

  // Try to open dropdown if needed
  const dropdownSvg = page.locator("div:nth-child(2) > .css-g5y9jx > svg");
  if (await dropdownSvg.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dropdownSvg.click();
    await page.waitForTimeout(300);
  }

  await relationshipInput.fill("Sibling");
  await page.waitForTimeout(300);

  // Step 13: Fill doctor/provider info
  const doctorInput = page.getByRole("textbox", {
    name: "Doctor/Healthcare Provider",
  });
  await expect(doctorInput).toBeVisible({ timeout: 10000 });
  await doctorInput.click();
  await page.waitForTimeout(300);

  const phoneInput = page.getByRole("textbox", { name: "+1 555-123-" });
  await expect(phoneInput).toBeVisible({ timeout: 10000 });
  await phoneInput.click();
  await phoneInput.fill("123456789");
  await page.waitForTimeout(300);

  // Step 14: Continue to next step
  const continueButton2 = page
    .locator("div")
    .filter({ hasText: /^Continue$/ })
    .first();
  await expect(continueButton2).toBeVisible({ timeout: 10000 });
  await continueButton2.click();
  await page.waitForTimeout(1000);

  // Step 15: Select product
  const continueButton3 = page
    .locator("div")
    .filter({ hasText: /^Continue$/ })
    .first();
  await expect(continueButton3).toBeVisible({ timeout: 10000 });
  await continueButton3.click();
  await page.waitForTimeout(1000);

  // Step 16: Select product from dialog
  const productText = page
    .getByRole("dialog")
    .getByText("Air Lift 57205 LoadLifter");
  await expect(productText).toBeVisible({ timeout: 10000 });
  await productText.click();
  await page.waitForTimeout(500);

  const yesButton = page.locator("div").filter({ hasText: /^Yes$/ }).first();
  await expect(yesButton).toBeVisible({ timeout: 5000 });
  await yesButton.click();
  await page.waitForTimeout(500);

  // Step 17: Select serial number and location
  const serialNumber = page.getByText("4564");
  await expect(serialNumber).toBeVisible({ timeout: 10000 });
  await serialNumber.click();
  await page.waitForTimeout(500);

  const locationText = page.getByText("tryy");
  await expect(locationText).toBeVisible({ timeout: 10000 });
  await locationText.click();
  await page.waitForTimeout(500);

  // Step 18: Add to cart
  const addToCartButton = page.getByText("Add to Cart");
  await expect(addToCartButton).toBeVisible({ timeout: 10000 });
  await addToCartButton.click();
  await page.waitForTimeout(1000);

  // Step 19: Continue through checkout
  const continueButton4 = page
    .locator("div")
    .filter({ hasText: /^Continue$/ })
    .first();
  await expect(continueButton4).toBeVisible({ timeout: 10000 });
  await continueButton4.click();
  await page.waitForTimeout(1000);

  const continueButton5 = page
    .locator("div")
    .filter({ hasText: /^Continue$/ })
    .first();
  await expect(continueButton5).toBeVisible({ timeout: 10000 });
  await continueButton5.click();
  await page.waitForTimeout(1000);

  // Step 20: Fill customer name if needed
  const customerNameInput = page.getByRole("textbox", {
    name: "Enter customer name",
  });
  if (await customerNameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await customerNameInput.click();
    await page.waitForTimeout(300);
  }

  const continueButton6 = page
    .locator("div")
    .filter({ hasText: /^Continue$/ })
    .first();
  await expect(continueButton6).toBeVisible({ timeout: 10000 });
  await continueButton6.click();
  await page.waitForTimeout(1000);

  // Step 21: Create order
  const createOrderButton2 = page
    .locator("div")
    .filter({ hasText: /^Create Order$/ })
    .nth(1);
  await expect(createOrderButton2).toBeVisible({ timeout: 10000 });
  await createOrderButton2.click();
  await page.waitForTimeout(2000);

  // Step 22: Verify order created
  const successMessage = page.getByText("Order created successfully.");
  await expect(successMessage).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

  // Step 23: Navigate to Orders
  const ordersButton = page.getByRole("button", { name: "Orders" });
  await expect(ordersButton).toBeVisible({ timeout: 10000 });
  await ordersButton.click();
  await page.waitForTimeout(1000);

  // Step 24: Click on order link (order number may vary, so we'll try to find it)
  // Wait for order list to load
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  // Try to find order link - it might be dynamic, so we'll look for a link with order number pattern
  const orderLink = page.getByRole("link", { name: /-000\d+/ });
  await expect(orderLink.first()).toBeVisible({ timeout: 15000 });
  await orderLink.first().click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  // Step 25: Click Fulfillment button
  const fulfillmentButton2 = page
    .getByRole("button", { name: "Fulfillment" })
    .nth(2);
  await expect(fulfillmentButton2).toBeVisible({ timeout: 10000 });
  await fulfillmentButton2.click();
  await page.waitForTimeout(1000);

  // Step 26: Continue Shipping
  const continueShippingButton = page.getByRole("button", {
    name: "Continue Shipping",
  });
  await expect(continueShippingButton).toBeVisible({ timeout: 10000 });
  await continueShippingButton.click();
  await page.waitForTimeout(1000);

  // Step 27: Select shipping method
  const emptyDropdown1 = page
    .locator("div")
    .filter({ hasText: /^empty$/ })
    .first();
  await expect(emptyDropdown1).toBeVisible({ timeout: 10000 });
  await emptyDropdown1.click();
  await page.waitForTimeout(500);

  const shippingOption = page.getByRole("option", { name: "Shipping" });
  await expect(shippingOption).toBeVisible({ timeout: 5000 });
  await shippingOption.click();
  await page.waitForTimeout(500);

  // Step 28: Add manual tracking
  const addTrackingButton = page.getByRole("button", {
    name: /Add Manual Tracking/i,
  });
  await expect(addTrackingButton).toBeVisible({ timeout: 10000 });
  await addTrackingButton.click();
  await page.waitForTimeout(1000);

  // Step 29: Fill tracking number
  const trackingInput = page.getByRole("textbox").nth(5);
  await expect(trackingInput).toBeVisible({ timeout: 10000 });
  await trackingInput.click();
  await trackingInput.fill("1234");
  await page.waitForTimeout(500);

  // Step 30: Select carrier
  const emptyDropdown2 = page
    .locator("div")
    .filter({ hasText: /^empty$/ })
    .first();
  await expect(emptyDropdown2).toBeVisible({ timeout: 10000 });
  await emptyDropdown2.click();
  await page.waitForTimeout(500);

  const upsOption = page.getByRole("option", { name: "UPS" });
  await expect(upsOption).toBeVisible({ timeout: 5000 });
  await upsOption.click();
  await page.waitForTimeout(500);

  // Step 31: Mark shipping in transit
  const markInTransitButton = page.getByRole("button", {
    name: "Mark Shipping In Transit",
  });
  await expect(markInTransitButton).toBeVisible({ timeout: 10000 });
  await markInTransitButton.click();
  await page.waitForTimeout(1000);

  const yesButton2 = page.getByRole("button", { name: "Yes" });
  await expect(yesButton2).toBeVisible({ timeout: 5000 });
  await yesButton2.click();
  await page.waitForTimeout(1000);

  // Step 32: Close dialog
  const closeButton = page.getByRole("button", { name: "close" });
  if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(500);
  }

  // Test completed successfully
  console.log("Rentals Order Flow test completed successfully!");
});
