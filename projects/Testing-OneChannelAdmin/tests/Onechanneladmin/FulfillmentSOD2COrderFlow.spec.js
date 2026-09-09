import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

test.describe("Fulfillment — SO D2C order", () => {
  test("full order and fulfillment flow", async ({ page }) => {
    let skuToSelect = "SKU";

    await test.step("Login", async () => {
      await loginOneChannelAdmin(page);
    });

    await test.step("Navigate to Fulfillment Orders", async () => {
      const fulfillmentButton = page.getByRole("button", { name: "Fulfillment" });
      await fulfillmentButton.click();
      await page.waitForTimeout(500);

      const ordersLink = page.getByRole("link", { name: "Orders", exact: true });
      await expect(ordersLink).toBeVisible({ timeout: 5000 });
      await ordersLink.click();

      await page.waitForURL(/fulfill.*orders/, { timeout: 10000 });
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
    });

    await test.step("Start new SO — D2C order", async () => {
      const addNewButton = page.getByRole("button", { name: /Add New/i }).first();
      await expect(addNewButton).toBeVisible({ timeout: 10000 });
      await addNewButton.click();

      const orderTypeMenuItem = page.getByRole("menuitem", {
        name: "SO - D2C Order",
      });
      await expect(orderTypeMenuItem).toBeVisible({ timeout: 5000 });
      await orderTypeMenuItem.click();

      await page.waitForTimeout(1000);
    });

    await test.step("Select SKU", async () => {
      const skuDropdown = page
        .locator(".p-dropdown")
        .filter({ has: page.locator("span", { hasText: "Select SKU" }) })
        .first();
      await expect(skuDropdown).toBeVisible({ timeout: 10000 });
      const skuTrigger = skuDropdown.locator(".p-dropdown-trigger").first();
      if (await skuTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skuTrigger.click();
      } else {
        await skuDropdown.click();
      }

      const filterInput = page.getByRole("textbox", {
        name: /Search by sku, title, upc/i,
      });
      await expect(filterInput).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);

      const listbox = page.getByRole("listbox");
      await expect(listbox).toBeVisible({ timeout: 10000 });
      const firstOption = page.getByRole("option").first();
      await expect(firstOption).toBeVisible({ timeout: 15000 });
      skuToSelect =
        (await firstOption.textContent())?.split("|")[0]?.trim() || "SKU";
      await firstOption.click();
    });

    await test.step("Add product row and open line", async () => {
      const addProductButton = page
        .getByRole("button", { name: /Add Product/i })
        .first();
      await expect(addProductButton).toBeVisible({ timeout: 5000 });
      await addProductButton.click();

      const productInTable = page
        .getByRole("table")
        .locator("div.table-column-text")
        .filter({ hasText: skuToSelect })
        .first();
      await expect(productInTable).toBeVisible({ timeout: 5000 });
      await productInTable.click();
    });

    await test.step("Assign user and payment", async () => {
      const userSearchbox = page.getByRole("searchbox", { name: "User" });
      await expect(userSearchbox).toBeVisible({ timeout: 5000 });
      await userSearchbox.click();
      await userSearchbox.fill("admin");

      const userOption = page.getByRole("option", {
        name: "admin@onechanneladmin.com",
      });
      await expect(userOption).toBeVisible({ timeout: 5000 });
      await userOption.click();

      const paymentDropdown = page.locator(
        ".p-col-12 > .p-dropdown > .p-dropdown-trigger"
      );
      await expect(paymentDropdown).toBeVisible({ timeout: 5000 });
      await paymentDropdown.click();

      const paymentDetailsSpan = page
        .locator("span")
        .filter({ hasText: "Payment Details" })
        .first();
      await expect(paymentDetailsSpan).toBeVisible({ timeout: 5000 });
      await paymentDetailsSpan.click();

      const payLaterOption = page.getByRole("option", { name: "Pay Later" });
      await expect(payLaterOption).toBeVisible({ timeout: 5000 });
      await payLaterOption.click();

      const fullAmount = page.getByText("Full Amount", { exact: true });
      const hasFullAmount = await fullAmount
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (hasFullAmount) {
        await fullAmount.click();
        await page.waitForTimeout(300);
        const chooseMethod = page.getByText("Choose Method", { exact: true });
        if (await chooseMethod.isVisible({ timeout: 2000 }).catch(() => false)) {
          await chooseMethod.click();
          await page.waitForTimeout(300);
        }
        const payWithCashOption = page.getByRole("option", {
          name: "Pay with cash",
        });
        await expect(payWithCashOption).toBeVisible({ timeout: 5000 });
        await payWithCashOption.click();
      }
    });

    await test.step("Create order — configure product", async () => {
      const createOrderButton = page
        .getByRole("button", { name: /Create Order/i })
        .first();
      await expect(createOrderButton).toBeVisible({ timeout: 5000 });
      await createOrderButton.click();

      await page.waitForTimeout(1000);

      const productText = page.getByText(skuToSelect).nth(1);
      await expect(productText).toBeVisible({ timeout: 5000 });
      await productText.click();

      const warehouseOption = page.getByText(/- WH$|WAREHOUSE/i).first();
      await expect(warehouseOption).toBeVisible({ timeout: 5000 });
      await warehouseOption.click();

      const checkbox = page.locator(
        "li:nth-child(2) > .field-checkbox > .p-checkbox > .p-checkbox-box"
      );
      await expect(checkbox).toBeVisible({ timeout: 5000 });
      await checkbox.click();

      const catalogDefault = page.getByText("Catalog Default - default,");
      await expect(catalogDefault).toBeVisible({ timeout: 5000 });
      await catalogDefault.click();

      const applyButton = page.getByRole("button", { name: "Apply" });
      await expect(applyButton).toBeVisible({ timeout: 5000 });
      await applyButton.click();

      await expect(createOrderButton).toBeVisible({ timeout: 5000 });
      await createOrderButton.click();

      await page.waitForTimeout(3000);
      const urlChanged = await page
        .waitForURL(/fulfill-orders|fulfill\/orders/, { timeout: 25000 })
        .then(() => true)
        .catch(() => false);
      if (!urlChanged) {
        await page.waitForTimeout(2000);
        if (!page.url().includes("fulfill-orders")) {
          await page.getByRole("link", { name: "Orders", exact: true }).click();
          await page.waitForURL(/fulfill-orders|fulfill\/orders/, {
            timeout: 10000,
          });
        }
      }
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1500);
    });

    await test.step("Open order from list", async () => {
      let orderLink = page.getByRole("link", { name: /-\d+.*D2C/i }).first();
      if (!(await orderLink.isVisible({ timeout: 3000 }).catch(() => false))) {
        orderLink = page.getByRole("link", { name: /-\d+/ }).first();
      }
      await expect(orderLink).toBeVisible({ timeout: 15000 });
      await orderLink.click();

      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
    });

    await test.step("Fulfillment — open dialog", async () => {
      const fulfillmentButton2 = page
        .getByRole("button", { name: /Fulfillment/i })
        .first();
      await expect(fulfillmentButton2).toBeVisible({ timeout: 10000 });
      await fulfillmentButton2.click();

      await page.waitForTimeout(2000);

      const continueShippingButton = page.getByRole("button", {
        name: /Continue Shipping/i,
      });

      const hasContinueButton = await continueShippingButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasContinueButton) {
        await continueShippingButton.click();
        await page.waitForTimeout(1000);
      }
    });

    await test.step("Shipping and manual tracking (if shown)", async () => {
      const emptyDropdown = page
        .locator("div")
        .filter({ hasText: /^empty$/i })
        .first();

      const hasShippingSection = await emptyDropdown
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (hasShippingSection) {
        await emptyDropdown.click();

        const shippingOption = page.getByRole("option", { name: "Shipping" });
        await expect(shippingOption).toBeVisible({ timeout: 5000 });
        await shippingOption.click();

        const addManualTrackingButton = page
          .getByRole("button", { name: /Add Manual Tracking/i })
          .first();
        await expect(addManualTrackingButton).toBeVisible({ timeout: 5000 });
        await addManualTrackingButton.click();

        const trackingTextbox = page.getByRole("textbox").nth(5);
        await expect(trackingTextbox).toBeVisible({ timeout: 5000 });
        await trackingTextbox.click();
        await trackingTextbox.fill("test tract");

        const emptyDropdown2 = page
          .locator("div")
          .filter({ hasText: /^empty$/i })
          .nth(1);
        await expect(emptyDropdown2).toBeVisible({ timeout: 5000 });
        await emptyDropdown2.click();

        const upsOption = page.getByRole("option", { name: "UPS" });
        await expect(upsOption).toBeVisible({ timeout: 5000 });
        await upsOption.click();

        const addButton = page
          .locator("#order-tab")
          .getByRole("button", { name: /Add/i, exact: true });
        await expect(addButton).toBeVisible({ timeout: 5000 });
        await addButton.click();

        const saveButton = page.locator("div:nth-child(2) > .p-col-2 > .p-button");
        await expect(saveButton).toBeVisible({ timeout: 5000 });
        await saveButton.click();

        const saveShippingButton = page.getByRole("button", {
          name: "Save Shipping",
        });
        await expect(saveShippingButton).toBeVisible({ timeout: 5000 });
        await saveShippingButton.click();
      }
    });

    await test.step("Mark shipping in transit", async () => {
      const fulfillmentButton3 = page
        .getByRole("button", { name: /Fulfillment/i })
        .first();
      await expect(fulfillmentButton3).toBeVisible({ timeout: 5000 });
      await fulfillmentButton3.click();

      await page.waitForTimeout(1000);

      const markInTransitButton = page.getByRole("button", {
        name: /Mark Shipping In Transit/i,
      });

      const hasMarkInTransit = await markInTransitButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasMarkInTransit) {
        await markInTransitButton.click();

        const yesButton = page.getByRole("button", { name: /Yes/i });
        await expect(yesButton).toBeVisible({ timeout: 5000 });
        await yesButton.click();
        await page.waitForTimeout(1000);
      }
    });

    await test.step("Close fulfillment and order details", async () => {
      const fulfillmentButton4 = page
        .getByLabel("Orders Details")
        .getByRole("button", { name: "Fulfillment" });
      await expect(fulfillmentButton4).toBeVisible({ timeout: 5000 });
      await fulfillmentButton4.click();

      const closeButton = page.getByRole("button", { name: "close" });
      await expect(closeButton).toBeVisible({ timeout: 5000 });
      await closeButton.click();
    });
  });
});
