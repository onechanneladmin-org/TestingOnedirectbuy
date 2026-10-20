import { test, expect } from "@playwright/test";

/**
 * Nexus D2C Border Flow Test Suite
 * Tests the complete end-to-end flow for Direct-to-Consumer order processing
 * including login, product selection, checkout, and payment
 */

// Test Configuration Constants
const BASE_URL = "http://localhost:3000";
const LOGIN_EMAIL = "sophie@onechanneladmin.com";
const LOGIN_PASSWORD = (process.env.TEST_LOGIN_PASSWORD || "");

// Test Data Constants
const TEST_DATA = {
  shipping: {
    firstName: "Sophie",
    lastName: "Doe",
    phone: "1234567891",
    address: "Orlando",
    city: "Texas",
    state: "Alaska",
    zipCode: "32003",
  },
  payment: {
    cardNumber: "4111 1111 1111 1111",
    expiryDate: "12/27",
    cvv: "123",
    zipCode: "32003",
  },
};

// Helper Functions
const helpers = {
  /**
   * Accept cookies if the cookie banner is present
   */
  async acceptCookies(page) {
    const acceptButton = page.getByRole("button", { name: "Accept All" });
    if (await acceptButton.isVisible().catch(() => false)) {
      await acceptButton.click();
    }
  },

  /**
   * Login to the application
   */
  async login(page) {
    await page.goto(`${BASE_URL}/`);
    await helpers.acceptCookies(page);

    // Navigate to login page
    const loginButton = page.getByText("Login");
    if (await loginButton.isVisible().catch(() => false)) {
      await loginButton.click();
    } else {
      await page.goto(`${BASE_URL}/login`);
    }

    // Wait for login page to load
    await expect(page).toHaveURL(/login/);

    // Fill login form
    await page
      .getByRole("textbox", { name: "Email address" })
      .fill(LOGIN_EMAIL);
    await page.getByRole("textbox", { name: "Password" }).fill(LOGIN_PASSWORD);

    // Submit login
    await page.getByRole("button", { name: "Login" }).click();

    // Wait for successful login redirect
    await page.waitForURL(/\/(dashboard|products|catalog|\/)$/, {
      timeout: 10000,
    });
  },

  /**
   * Navigate to catalog and select a product
   */
  async selectProduct(page) {
    await page.goto(`${BASE_URL}/`);
    await page.getByRole("link", { name: "Catalog" }).click();

    // Filter products - select page 2
    await page.getByRole("button", { name: "2" }).click();

    // Filter by in-stock items only
    await page.getByRole("checkbox", { name: "In Stock Only" }).check();

    // Wait for products to load
    await page.waitForLoadState("networkidle");

    // Add first available product to cart
    const addToCartButton = page
      .getByRole("button", { name: "Add to cart" })
      .nth(1);
    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();
  },

  /**
   * Navigate to checkout page
   */
  async navigateToCheckout(page) {
    // Open cart
    await page.getByRole("button", { name: "1" }).click();

    // Proceed to checkout
    await page.getByRole("button", { name: "Proceed to Checkout" }).click();

    // Verify checkout page loaded
    await expect(page).toHaveURL(/checkout/);
  },

  /**
   * Fill shipping information form
   */
  async fillShippingInfo(page, shippingData = TEST_DATA.shipping) {
    await expect(
      page.getByRole("textbox", { name: "John", exact: true })
    ).toBeVisible();

    await page
      .getByRole("textbox", { name: "John", exact: true })
      .fill(shippingData.firstName);
    await page
      .getByRole("textbox", { name: "Doe", exact: true })
      .fill(shippingData.lastName);
    await page
      .getByRole("textbox", { name: "(555) 123-" })
      .fill(shippingData.phone);
    await page
      .getByRole("textbox", { name: "Main Street" })
      .fill(shippingData.address);
    await page
      .getByRole("textbox", { name: "New York" })
      .fill(shippingData.city);
    await page.getByRole("combobox").selectOption(shippingData.state);
    await page
      .getByRole("textbox", { name: "10001" })
      .fill(shippingData.zipCode);
  },

  /**
   * Fill payment information in iframe
   */
  async fillPaymentInfo(page, paymentData = TEST_DATA.payment) {
    // Wait for payment iframe to be available
    const iframeSelector = 'iframe[name^="single-card-"]';
    await page.waitForSelector(iframeSelector, { timeout: 10000 });

    const iframe = page.locator(iframeSelector).first();
    const frame = await iframe.contentFrame();

    // Fill card details
    await frame
      .getByRole("textbox", { name: "Card number" })
      .fill(paymentData.cardNumber);
    await frame
      .getByRole("textbox", { name: "MM/YY" })
      .fill(paymentData.expiryDate);
    await frame.getByRole("textbox", { name: "CVV" }).fill(paymentData.cvv);
    await frame.getByRole("textbox", { name: "ZIP" }).fill(paymentData.zipCode);
  },

  /**
   * Complete the payment process
   */
  async completePayment(page) {
    await page.getByRole("button", { name: "Pay" }).click();

    // Wait for order success page
    await page.waitForURL(/order-success/, { timeout: 15000 });
    await expect(page).toHaveURL(/order-success/);
  },
};

/**
 * Main Test: Complete D2C Order Flow
 * Tests the full customer journey from login to order completion
 */
test("should complete D2C order flow from login to order success", async ({
  page,
}) => {
  // Step 1: Login to the application
  await helpers.login(page);

  // Step 2: Select product and add to cart
  await helpers.selectProduct(page);

  // Step 3: Navigate to checkout
  await helpers.navigateToCheckout(page);

  // Step 4: Fill shipping information
  await helpers.fillShippingInfo(page);

  // Step 5: Continue to payment
  await page.getByRole("button", { name: "Continue to Payment" }).click();

  // Step 6: Fill payment information
  await helpers.fillPaymentInfo(page);

  // Step 7: Complete payment
  await helpers.completePayment(page);

  // Step 8: Verify order success and navigate to orders
  await expect(page).toHaveURL(/order-success/);

  // Navigate to orders page
  const menuButton = page.getByRole("button").nth(5);
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  }
  await page.getByText("Orders").click();

  // Verify navigation to orders page
  await expect(page).toHaveURL(/orders/);
});
