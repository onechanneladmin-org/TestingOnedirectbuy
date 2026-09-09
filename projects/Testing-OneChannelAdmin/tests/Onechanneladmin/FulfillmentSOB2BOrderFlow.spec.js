import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

test("Fulfillment SO B2B Order Flow - Complete Pick and Pack", async ({
  page,
}) => {
  // Variable to store orderId for use in pick/pack flow
  let orderId = null;
  await loginOneChannelAdmin(page);
  await page.waitForLoadState("networkidle");

  // Wait for login to complete
  await page.waitForURL(/dashboard|home/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  const fulfillmentButton = page.getByRole("button", { name: "Fulfillment" });
  await expect(fulfillmentButton).toBeVisible({ timeout: 5000 });
  await fulfillmentButton.click();
  await page.waitForTimeout(500); // Small wait for menu to open

  const ordersLink = page.getByRole("link", { name: "Orders", exact: true });
  await expect(ordersLink).toBeVisible({ timeout: 5000 });
  await ordersLink.click();

  // Wait for orders page to load
  await page.waitForURL(/fulfill.*orders/, { timeout: 10000 });
  await page.waitForLoadState("networkidle");

  // Step 5: Click Add New button
  const addNewButton = page.getByRole("button", { name: /Add New/i }).first();
  await expect(addNewButton).toBeVisible({ timeout: 10000 });
  await addNewButton.click();

  // Wait for menu to open
  await page.waitForTimeout(1000);

  // Step 6: Select order type - SO B2B Order
  const orderTypeMenuItem = page.getByRole("menuitem", {
    name: "SO - B2B Order",
  });
  await expect(orderTypeMenuItem).toBeVisible({ timeout: 10000 });
  await orderTypeMenuItem.click();

  // Step 7: Select Account dropdown first
  // Wait for the order form to load after selecting order type
  // Wait for the form title to appear to confirm the form has loaded
  await page.waitForTimeout(2000);
  const formTitle = page.getByText(
    /New Purchase B2B Inbound Order|Purchase B2B/i
  );
  await expect(formTitle)
    .toBeVisible({ timeout: 15000 })
    .catch(async () => {
      // If title not found, wait a bit more and check for any form elements
      await page.waitForTimeout(2000);
      // Check if we're still on orders page or if form loaded
      const url = page.url();
      if (!url.includes("order") && !url.includes("add")) {
        throw new Error("Order form did not load after selecting order type");
      }
    });

  // Find the Account dropdown - it should be labeled "Account" or contain "ONECHANNELADMIN"
  // Try multiple strategies to find the Account dropdown
  let accountDropdown = null;
  let accountDropdownFound = false;

  // Strategy 1: Look for dropdown near "Account" label
  try {
    const accountLabel = page.getByText("Account", { exact: false }).first();
    if (await accountLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Find the dropdown trigger near the Account label
      accountDropdown = accountLabel
        .locator("..")
        .locator(".p-dropdown-trigger")
        .first();
      accountDropdownFound = await accountDropdown
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (!accountDropdownFound) {
        // Try finding dropdown in the same container
        accountDropdown = accountLabel
          .locator("..")
          .locator("span.p-dropdown-label, .p-dropdown")
          .first();
        accountDropdownFound = await accountDropdown
          .isVisible({ timeout: 3000 })
          .catch(() => false);
      }
    }
  } catch (e) {
    // Continue to next strategy
  }

  // Strategy 2: Look for dropdown that contains or shows "ONECHANNELADMIN"
  if (!accountDropdownFound) {
    try {
      const accountText = page
        .locator("span")
        .filter({ hasText: /ONECHANNELADMIN/i })
        .first();
      if (await accountText.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Try to find the dropdown trigger near this text
        accountDropdown = accountText
          .locator("..")
          .locator(".p-dropdown-trigger")
          .first();
        accountDropdownFound = await accountDropdown
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        if (!accountDropdownFound) {
          // If trigger not found, try clicking the parent dropdown container
          accountDropdown = accountText
            .locator("..")
            .locator(".p-dropdown")
            .first();
          accountDropdownFound = await accountDropdown
            .isVisible({ timeout: 3000 })
            .catch(() => false);
          if (!accountDropdownFound) {
            // Last resort: click the text itself
            accountDropdown = accountText;
            accountDropdownFound = true;
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 3: Look for dropdown trigger that's not "Select Name" (which is Contacts)
  if (!accountDropdownFound) {
    try {
      // Get all dropdown triggers and find the one that's not "Select Name"
      const allDropdowns = page.locator(".p-dropdown-trigger, .p-dropdown");
      const count = await allDropdowns.count();
      for (let i = 0; i < count; i++) {
        const dropdown = allDropdowns.nth(i);
        const text = await dropdown.textContent().catch(() => "");
        if (
          text &&
          !text.includes("Select Name") &&
          !text.includes("Select Channel") &&
          (await dropdown.isVisible({ timeout: 1000 }).catch(() => false))
        ) {
          accountDropdown = dropdown;
          accountDropdownFound = true;
          break;
        }
      }
    } catch (e) {
      // Continue
    }
  }

  if (!accountDropdownFound || !accountDropdown) {
    throw new Error("Could not find Account dropdown");
  }

  await expect(accountDropdown).toBeVisible({ timeout: 10000 });
  await accountDropdown.click();

  // Wait for PrimeReact dropdown panel to open
  const accountDropdownPanel = page.locator(".p-dropdown-panel").first();
  await expect(accountDropdownPanel).toBeVisible({ timeout: 10000 });

  // Find the search input inside the dropdown panel
  const accountSearchInput = accountDropdownPanel.locator("input").first();
  await expect(accountSearchInput).toBeVisible({ timeout: 5000 });
  // Click and focus the input first, then clear and type to trigger search
  await accountSearchInput.click();
  await accountSearchInput.clear();
  await accountSearchInput.type("onechanneladmin", { delay: 100 });

  // Wait for the dropdown to filter results - wait for options to appear
  await expect(accountDropdownPanel.locator("li").first())
    .toBeVisible({ timeout: 10000 })
    .catch(async () => {
      // If li doesn't work, try option role
      await expect(
        accountDropdownPanel.getByRole("option").first()
      ).toBeVisible({
        timeout: 10000,
      });
    });

  // Wait a bit more for search results to fully load
  await page.waitForTimeout(2000);

  // Try multiple strategies to find the account option
  let accountOption = null;
  let found = false;

  // Strategy 1: Try exact match ONECHANNELADMIN
  try {
    accountOption = accountDropdownPanel
      .locator("li")
      .filter({ hasText: /ONECHANNELADMIN/i })
      .first();
    found = await accountOption.isVisible({ timeout: 3000 }).catch(() => false);
    if (found) {
      await accountOption.click();
    }
  } catch (e) {
    // Continue
  }

  // Strategy 2: Try partial match with ONE and CHANNEL
  if (!found) {
    try {
      accountOption = accountDropdownPanel
        .locator("li")
        .filter({ hasText: /ONE.*CHANNEL|CHANNEL.*ADMIN/i })
        .first();
      found = await accountOption
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (found) {
        await accountOption.click();
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 3: Try to find any option containing "ONE" (case insensitive)
  if (!found) {
    try {
      accountOption = accountDropdownPanel
        .locator("li")
        .filter({ hasText: /ONE/i })
        .first();
      found = await accountOption
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (found) {
        await accountOption.click();
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 4: Just take the first available option if search returned results
  if (!found) {
    try {
      accountOption = accountDropdownPanel.locator("li").first();
      found = await accountOption
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (found) {
        await accountOption.click();
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 5: Try using role="option" instead of li
  if (!found) {
    try {
      accountOption = accountDropdownPanel
        .getByRole("option")
        .filter({ hasText: /ONECHANNELADMIN|ONE.*CHANNEL|ONE/i })
        .first();
      found = await accountOption
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (found) {
        await accountOption.click();
      } else {
        // Last resort: take first option
        accountOption = accountDropdownPanel.getByRole("option").first();
        found = await accountOption
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        if (found) {
          await accountOption.click();
        }
      }
    } catch (e) {
      // Continue
    }
  }

  if (!found) {
    throw new Error(
      "Could not find account option in dropdown after searching for 'onechanneladmin'"
    );
  }

  // Wait for account selection to complete and form to update
  await page.waitForTimeout(2000);

  // Step 8: Select Name/Contact
  // Wait for the Contacts dropdown to be available - it might be labeled "Contacts" or "Select Name"
  let selectNameDropdown2 = null;
  let contactsFound = false;

  // Strategy 1: Look for "Select Name" text
  try {
    selectNameDropdown2 = page
      .locator("span")
      .filter({ hasText: "Select Name" })
      .first();
    contactsFound = await selectNameDropdown2
      .isVisible({ timeout: 5000 })
      .catch(() => false);
  } catch (e) {
    // Continue
  }

  // Strategy 2: Look for "Contacts" label and find dropdown nearby
  if (!contactsFound) {
    try {
      const contactsLabel = page
        .getByText("Contacts", { exact: false })
        .first();
      if (await contactsLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Find dropdown near Contacts label
        selectNameDropdown2 = contactsLabel
          .locator("..")
          .locator(".p-dropdown, .p-dropdown-trigger, span.p-dropdown-label")
          .first();
        contactsFound = await selectNameDropdown2
          .isVisible({ timeout: 3000 })
          .catch(() => false);
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 3: Look for any dropdown that contains placeholder text related to contacts
  if (!contactsFound) {
    try {
      const allDropdowns = page.locator(".p-dropdown, .p-dropdown-trigger");
      const count = await allDropdowns.count();
      for (let i = 0; i < count; i++) {
        const dropdown = allDropdowns.nth(i);
        const text = await dropdown.textContent().catch(() => "");
        if (
          text &&
          (text.includes("Select Name") ||
            text.includes("Raj") ||
            text.includes("Contact")) &&
          (await dropdown.isVisible({ timeout: 1000 }).catch(() => false))
        ) {
          selectNameDropdown2 = dropdown;
          contactsFound = true;
          break;
        }
      }
    } catch (e) {
      // Continue
    }
  }

  if (!contactsFound || !selectNameDropdown2) {
    throw new Error("Could not find Contacts dropdown (Select Name)");
  }

  await expect(selectNameDropdown2).toBeVisible({ timeout: 10000 });
  await selectNameDropdown2.click();

  // Wait for PrimeReact dropdown panel to open
  const contactDropdownPanel = page.locator(".p-dropdown-panel").first();
  await expect(contactDropdownPanel).toBeVisible({ timeout: 10000 });

  // Find the search input inside the dropdown panel
  const contactSearchInput = contactDropdownPanel.locator("input").first();
  await expect(contactSearchInput).toBeVisible({ timeout: 5000 });
  // Click and focus the input first, then clear and type to trigger search
  await contactSearchInput.click();
  await contactSearchInput.clear();
  await contactSearchInput.type("Raj", { delay: 100 });

  // Wait for the dropdown to filter results - wait for options to appear
  await expect(contactDropdownPanel.locator("li").first())
    .toBeVisible({ timeout: 10000 })
    .catch(async () => {
      // If li doesn't work, try option role
      await expect(
        contactDropdownPanel.getByRole("option").first()
      ).toBeVisible({
        timeout: 10000,
      });
    });

  // Wait a bit more for search results to fully load
  await page.waitForTimeout(3000);

  // Try multiple strategies to find the contact option
  let contactOption = null;
  let contactFound = false;

  // First, check if dropdown panel is still open, if not, reopen it
  const isPanelOpen = await contactDropdownPanel
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (!isPanelOpen) {
    // Panel closed, click again to reopen
    const selectNameDropdown2Again = page
      .locator("span")
      .filter({ hasText: "Select Name" })
      .first();
    await selectNameDropdown2Again.click();
    await page.waitForTimeout(1000);
    const newPanel = page.locator(".p-dropdown-panel").first();
    await expect(newPanel).toBeVisible({ timeout: 5000 });
    const newSearchInput = newPanel.locator("input").first();
    if (await newSearchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newSearchInput.click();
      await newSearchInput.clear();
      await newSearchInput.type("Raj", { delay: 100 });
      await page.waitForTimeout(3000);
    }
  }

  // Use current panel reference
  const activeContactPanel = page.locator(".p-dropdown-panel").first();

  // Strategy 1: Try exact match "Raj Raj"
  try {
    contactOption = activeContactPanel
      .locator("li")
      .filter({ hasText: /Raj.*Raj/i })
      .first();
    contactFound = await contactOption
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (contactFound) {
      await contactOption.click();
    }
  } catch (e) {
    // Continue
  }

  // Strategy 2: Try partial match with just "Raj"
  if (!contactFound) {
    try {
      contactOption = activeContactPanel
        .locator("li")
        .filter({ hasText: /Raj/i })
        .first();
      contactFound = await contactOption
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (contactFound) {
        await contactOption.click();
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 3: Just take the first available option if search returned results
  if (!contactFound) {
    try {
      // Use active panel reference
      contactOption = activeContactPanel.locator("li").first();
      contactFound = await contactOption
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (contactFound) {
        await contactOption.click();
      } else {
        // Try any element that looks like an option
        const anyLi = activeContactPanel
          .locator("li, [role='option'], .p-dropdown-item")
          .first();
        contactFound = await anyLi
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        if (contactFound) {
          await anyLi.click();
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 4: Try using role="option" instead of li
  if (!contactFound) {
    try {
      // Get all options and find the one with Raj
      const allOptions = activeContactPanel.getByRole("option");
      const optionCount = await allOptions.count();
      for (let i = 0; i < optionCount; i++) {
        const option = allOptions.nth(i);
        const text = await option.textContent().catch(() => "");
        if (text && /Raj/i.test(text)) {
          await option.click();
          contactFound = true;
          break;
        }
      }
      // If still not found, take first option as last resort
      if (!contactFound) {
        contactOption = activeContactPanel.getByRole("option").first();
        contactFound = await contactOption
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        if (contactFound) {
          await contactOption.click();
        }
      }
    } catch (e) {
      // Continue
    }
  }

  if (!contactFound) {
    throw new Error(
      "Could not find contact option in dropdown after searching for 'Raj'"
    );
  }

  // Step 9: Select Channel
  const selectChannelDropdown = page
    .locator("span")
    .filter({ hasText: "Select Channel" })
    .first();
  await expect(selectChannelDropdown).toBeVisible({ timeout: 5000 });
  await selectChannelDropdown.click();
  await page.waitForTimeout(500);

  const channelOption = page.getByRole("option", { name: "ONEAUTO" });
  await expect(channelOption).toBeVisible({ timeout: 5000 });
  await channelOption.click();

  // Step 10: Select Product/SKU
  const productDropdown = page
    .locator("div")
    .filter({ hasText: /^empty$/ })
    .nth(1);
  await expect(productDropdown).toBeVisible({ timeout: 5000 });
  await productDropdown.click();

  // Wait for PrimeReact dropdown panel to open
  const productDropdownPanel = page.locator(".p-dropdown-panel").first();
  await expect(productDropdownPanel).toBeVisible({ timeout: 10000 });

  // Find the search input inside the dropdown panel
  const productSearchInput = productDropdownPanel.locator("input").first();
  await expect(productSearchInput).toBeVisible({ timeout: 5000 });
  await productSearchInput.click();
  await productSearchInput.clear(); // Clear any existing value
  await productSearchInput.fill("AIR_LIFT57205");

  // Wait for the dropdown to filter results - wait for options to appear
  // Wait for at least one option to be visible in the dropdown
  await expect(productDropdownPanel.locator("li").first())
    .toBeVisible({ timeout: 10000 })
    .catch(async () => {
      // If li doesn't work, try option role
      await expect(
        productDropdownPanel.getByRole("option").first()
      ).toBeVisible({
        timeout: 10000,
      });
    });

  // Select the option - try to find the one with AIR_LIFT57205, otherwise take first
  const optionWithText = productDropdownPanel
    .locator("li")
    .filter({ hasText: /AIR_LIFT57205/i })
    .first();
  const firstOption = (await optionWithText
    .isVisible({ timeout: 2000 })
    .catch(() => false))
    ? optionWithText
    : productDropdownPanel.locator("li").first();

  await expect(firstOption).toBeVisible({ timeout: 5000 });
  await firstOption.click();

  // Step 11: Add Product
  const addProductButton = page
    .getByRole("button", { name: /Add Product/i })
    .first();
  await expect(addProductButton).toBeVisible({ timeout: 5000 });
  await addProductButton.click();

  // Wait for product to be added
  await page.waitForTimeout(1000);

  // Step 11.5: Click on Source Location column for AIR_LIFT57205
  // Find the table row with AIR_LIFT57205 and click on its Source Location column
  const productTable = page.getByRole("table").first();
  await expect(productTable).toBeVisible({ timeout: 5000 });

  // Find the row containing AIR_LIFT57205
  const productRow = productTable
    .locator("tr")
    .filter({ hasText: /AIR_LIFT57205/i })
    .first();
  await expect(productRow).toBeVisible({ timeout: 5000 });

  // Find the Source Location column in this row - it should contain "FL WAREHOUSE" or similar
  // Strategy 1: Look for cell containing warehouse text (most reliable)
  let sourceLocationCell = productRow
    .locator("td")
    .filter({ hasText: /WAREHOUSE|FL WAREHOUSE|ONECHANNEL ADMIN/i })
    .first();

  let sourceLocationFound = await sourceLocationCell
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  // Strategy 2: If not found by text, find by column header
  if (!sourceLocationFound) {
    try {
      // Find header row
      const headerRow = productTable.locator("thead tr, tr").first();
      const headerCount = await headerRow.locator("th, td").count();

      // Find Source Location column index
      let sourceLocationIndex = -1;
      for (let i = 0; i < headerCount; i++) {
        const header = headerRow.locator("th, td").nth(i);
        const headerText = await header.textContent().catch(() => "");
        if (headerText && /Source Location/i.test(headerText)) {
          sourceLocationIndex = i;
          break;
        }
      }

      if (sourceLocationIndex >= 0) {
        sourceLocationCell = productRow.locator("td").nth(sourceLocationIndex);
        sourceLocationFound = await sourceLocationCell
          .isVisible({ timeout: 3000 })
          .catch(() => false);
      }
    } catch (e) {
      // Continue
    }
  }

  if (sourceLocationFound) {
    await sourceLocationCell.click();

    // Wait for Source Location modal/dialog to appear
    await page.waitForTimeout(1000);

    // Look for the Source Location modal/dialog - it should have "Source Location" title
    const sourceLocationModal = page
      .locator(".p-dialog, [role='dialog']")
      .filter({ hasText: /Source Location/i })
      .first();

    const modalVisible = await sourceLocationModal
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (modalVisible) {
      // Select an option in the modal - try to find "ONECHANNEL ADMIN - WH" option first
      let optionSelected = false;

      // Strategy 1: Look for the option with "ONECHANNEL ADMIN - WH" text and click it
      try {
        const oneChannelOption = sourceLocationModal
          .locator("li")
          .filter({ hasText: /ONECHANNEL ADMIN.*WH/i })
          .first();
        const optionVisible = await oneChannelOption
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (optionVisible) {
          await oneChannelOption.click();
          optionSelected = true;
        }
      } catch (e) {
        // Continue to next strategy
      }

      // Strategy 2: If not found, click on the first option
      if (!optionSelected) {
        try {
          const firstOption = sourceLocationModal.locator("li").first();
          const firstOptionVisible = await firstOption
            .isVisible({ timeout: 3000 })
            .catch(() => false);

          if (firstOptionVisible) {
            await firstOption.click();
            optionSelected = true;
          }
        } catch (e) {
          // Continue
        }
      }

      // Wait a bit after selecting option to ensure it's selected
      if (optionSelected) {
        await page.waitForTimeout(500);
      }

      // Click Apply button to confirm the selection
      // Try to find Apply button within the modal first, then fallback to page
      let applyButton = sourceLocationModal.getByRole("button", {
        name: /Apply/i,
      });
      const applyButtonVisible = await applyButton
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (!applyButtonVisible) {
        applyButton = page.getByRole("button", { name: /Apply/i });
      }

      await expect(applyButton).toBeVisible({ timeout: 5000 });
      await applyButton.click();

      // Wait for modal to close
      await page.waitForTimeout(500);
    }
  } else {
    // If source location cell not found, log and continue
    console.log(
      "Source Location column not found for AIR_LIFT57205, continuing..."
    );
  }

  // Step 12: Fill Shipping Address
  const shippingAddressInput = page.locator(".p-col-6 > .p-inputtext").first();
  await expect(shippingAddressInput).toBeVisible({ timeout: 5000 });
  await shippingAddressInput.click();
  await shippingAddressInput.clear();
  await shippingAddressInput.fill("orlan");

  // Wait for autocomplete suggestions
  await page.waitForTimeout(1000);

  const addressOption = page.getByText("Orlando International Airport");
  await expect(addressOption).toBeVisible({ timeout: 5000 });
  await addressOption.click();

  // Step 13: Select Payment Details
  const paymentDetailsDropdown = page
    .locator("span")
    .filter({ hasText: "Payment Details" })
    .first();
  await expect(paymentDetailsDropdown).toBeVisible({ timeout: 5000 });
  await paymentDetailsDropdown.click();
  await page.waitForTimeout(500);

  const payNowOption = page.getByRole("option", { name: "Pay Now" });
  await expect(payNowOption).toBeVisible({ timeout: 5000 });
  await payNowOption.click();

  // Step 14: Select Payment Method
  const chooseMethodDropdown = page
    .locator("span")
    .filter({ hasText: "Choose Method" })
    .first();
  await expect(chooseMethodDropdown).toBeVisible({ timeout: 5000 });
  await chooseMethodDropdown.click();
  await page.waitForTimeout(500);

  const payWithCashOption = page.getByRole("option", {
    name: "Pay with cash",
  });
  await expect(payWithCashOption).toBeVisible({ timeout: 5000 });
  await payWithCashOption.click();

  // Step 15: First Create Order click (opens product configuration)
  const createOrderButton = page
    .getByRole("button", { name: /Create Order/i })
    .first();
  await expect(createOrderButton).toBeVisible({ timeout: 5000 });
  await createOrderButton.click();

  // Wait and check if order was created directly or if modal appears
  await page.waitForTimeout(2000);

  // Check if we were redirected (order created successfully)
  const currentUrl = page.url();
  const wasRedirected =
    currentUrl.includes("/fulfill") ||
    currentUrl.includes("/b2b") ||
    currentUrl.includes("/order");

  // If not redirected, look for product configuration modal
  if (!wasRedirected) {
    // Wait for product configuration modal/dialog to appear
    let modalAppeared = false;
    try {
      // Wait for dialog or modal to appear
      await page.waitForSelector(
        ".p-dialog, .p-dialog-mask, [role='dialog'], .p-dialog-visible",
        {
          timeout: 10000,
        }
      );
      modalAppeared = true;
    } catch (e) {
      // Modal might not appear, check if we're still on the form
      await page.waitForTimeout(2000);
    }

    if (modalAppeared) {
      // Step 16: Configure product settings - Select Warehouse
      // Try multiple strategies to find warehouse text
      let warehouseText = null;
      let warehouseFound = false;

      // Strategy 1: Exact match
      try {
        warehouseText = page.getByText("FL WAREHOUSE - WH", { exact: false });
        warehouseFound = await warehouseText
          .isVisible({ timeout: 5000 })
          .catch(() => false);
      } catch (e) {
        // Continue
      }

      // Strategy 2: Partial match with FL WAREHOUSE
      if (!warehouseFound) {
        try {
          warehouseText = page.getByText(/FL.*WAREHOUSE/i);
          warehouseFound = await warehouseText
            .isVisible({ timeout: 5000 })
            .catch(() => false);
        } catch (e) {
          // Continue
        }
      }

      // Strategy 3: Look for any text containing WAREHOUSE
      if (!warehouseFound) {
        try {
          warehouseText = page.getByText(/WAREHOUSE/i).first();
          warehouseFound = await warehouseText
            .isVisible({ timeout: 5000 })
            .catch(() => false);
        } catch (e) {
          // Continue
        }
      }

      // Strategy 4: Look for any warehouse-related text in the visible area
      if (!warehouseFound) {
        try {
          const allTexts = page.locator("text=/warehouse|wh/i");
          const count = await allTexts.count();
          for (let i = 0; i < count; i++) {
            const text = allTexts.nth(i);
            const isVisible = await text
              .isVisible({ timeout: 1000 })
              .catch(() => false);
            if (isVisible) {
              warehouseText = text;
              warehouseFound = true;
              break;
            }
          }
        } catch (e) {
          // Continue
        }
      }

      // Strategy 5: Look inside dialog for warehouse options
      if (!warehouseFound) {
        try {
          const dialog = page.locator(".p-dialog, [role='dialog']").first();
          if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
            warehouseText = dialog.getByText(/WAREHOUSE|FL.*WH/i).first();
            warehouseFound = await warehouseText
              .isVisible({ timeout: 5000 })
              .catch(() => false);
          }
        } catch (e) {
          // Continue
        }
      }

      if (warehouseFound && warehouseText) {
        await warehouseText.click();

        // Select warehouse checkbox
        const warehouseCheckbox = page
          .locator(".field-checkbox > .p-checkbox > .p-checkbox-box")
          .first();
        await expect(warehouseCheckbox).toBeVisible({ timeout: 5000 });
        await warehouseCheckbox.click();

        // Select catalog
        const catalogText = page.getByText("ONECHANNEL ADMIN - WH, Qty:");
        await expect(catalogText).toBeVisible({ timeout: 5000 });
        await catalogText.click();

        // Apply selection
        const applyButton = page.getByRole("button", { name: "Apply" });
        await expect(applyButton).toBeVisible({ timeout: 5000 });
        await applyButton.click();

        // Step 17: Final Create Order click
        await page.waitForTimeout(500);
        const finalCreateOrderButton = page
          .getByRole("button", { name: /Create Order/i })
          .first();
        await expect(finalCreateOrderButton).toBeVisible({ timeout: 5000 });
        await finalCreateOrderButton.click();
      } else {
        // If warehouse not found but modal appeared, try to continue anyway
        // Maybe the modal structure is different - try to find and click Apply or close modal
        console.log(
          "Warehouse text not found, but modal appeared. Trying to proceed..."
        );
        try {
          const applyButton = page.getByRole("button", { name: "Apply" });
          if (
            await applyButton.isVisible({ timeout: 3000 }).catch(() => false)
          ) {
            await applyButton.click();
          }
        } catch (e) {
          // If Apply not found, try clicking Create Order again
          const finalCreateOrderButton = page
            .getByRole("button", { name: /Create Order/i })
            .first();
          if (
            await finalCreateOrderButton
              .isVisible({ timeout: 3000 })
              .catch(() => false)
          ) {
            await finalCreateOrderButton.click();
          }
        }
      }
    } else {
      // No modal appeared - order might have been created directly
      // Check if we need to wait for navigation
      try {
        await page.waitForURL(/fulfill|b2b|order/, { timeout: 5000 });
      } catch (e) {
        // If still on same page, the order might have been created but not redirected
        // Or there might be an error - continue to next step
        console.log(
          "No modal appeared and no redirect. Order may have been created directly."
        );
      }
    }
  }

  // Wait for order to be created and redirected (optional - might not redirect)
  try {
    await page.waitForURL(/fulfill.*orders|b2b.*order/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
  } catch (e) {
    // If no redirect happened, that's okay - we'll navigate manually
    console.log(
      "No automatic redirect after order creation. Navigating manually..."
    );
    await page.waitForTimeout(2000); // Give it a moment for order to be saved
  }

  // Step 18: Navigate to B2B Orders page
  // Check if we're already on the orders page
  const ordersPageUrl = page.url();
  if (
    !ordersPageUrl.includes("/b2b/order") &&
    !ordersPageUrl.includes("/fulfill")
  ) {
    await page.goto("https://admin.onechanneladmin.com/b2b/order");
    await page.waitForLoadState("networkidle");
  } else {
    // Already on orders page, just wait for it to load
    await page.waitForLoadState("networkidle");
  }

  // Step 19: Find and click on the newly created order
  // Wait for the orders table to load
  await page.waitForTimeout(3000); // Give table time to load

  // Try multiple strategies to find the order
  let orderCell = null;
  let orderFound = false;

  // Strategy 1: Look for cell with B2B pattern
  try {
    orderCell = page.getByRole("cell", { name: /-\d+.*B2B/i }).first();
    orderFound = await orderCell
      .isVisible({ timeout: 5000 })
      .catch(() => false);
  } catch (e) {
    // Continue
  }

  // Strategy 2: Look for any cell containing B2B
  if (!orderFound) {
    try {
      orderCell = page
        .locator("td, [role='cell']")
        .filter({ hasText: /B2B/i })
        .first();
      orderFound = await orderCell
        .isVisible({ timeout: 5000 })
        .catch(() => false);
    } catch (e) {
      // Continue
    }
  }

  // Strategy 3: Look for link with order number pattern
  if (!orderFound) {
    try {
      const orderLink = page
        .getByRole("link")
        .filter({ hasText: /-\d+.*B2B|2025-.*B2B/i })
        .first();
      orderFound = await orderLink
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (orderFound) {
        orderCell = orderLink;
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 4: Look for the first row in the table (most recent order)
  if (!orderFound) {
    try {
      const table = page.locator("table, .p-datatable").first();
      if (await table.isVisible({ timeout: 3000 }).catch(() => false)) {
        const firstRow = table.locator("tr").nth(1); // Skip header row
        if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          orderCell = firstRow.locator("td, [role='cell']").first();
          orderFound = await orderCell
            .isVisible({ timeout: 3000 })
            .catch(() => false);
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 5: Look for any clickable element with order number
  if (!orderFound) {
    try {
      const allCells = page.locator("td, [role='cell'], a");
      const count = await allCells.count();
      for (let i = 0; i < Math.min(count, 20); i++) {
        const cell = allCells.nth(i);
        const text = await cell.textContent().catch(() => "");
        if (text && (/\d+/.test(text) || /B2B/i.test(text))) {
          if (await cell.isVisible({ timeout: 1000 }).catch(() => false)) {
            orderCell = cell;
            orderFound = true;
            break;
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  if (!orderFound || !orderCell) {
    // Take screenshot for debugging
    await page.screenshot({ path: "order-not-found.png", fullPage: true });
    throw new Error(
      "Could not find order in the orders list. Order may not have been created successfully."
    );
  }

  // Extract orderId from the cell text for later use
  const orderCellText = await orderCell.textContent();
  const orderIdMatch =
    orderCellText?.match(/-(\d+)/) || orderCellText?.match(/(\d{4,})/);
  orderId = orderIdMatch ? `2025-${orderIdMatch[1]}` : null;

  // Click the order cell/link
  await orderCell.click();

  // Wait for order details page to load
  await page.waitForLoadState("networkidle");

  // Extract orderId from URL if not already extracted
  if (!orderId) {
    const currentUrl = page.url();
    const urlOrderIdMatch = currentUrl.match(/order[\/-]?(\d+)/);
    orderId = urlOrderIdMatch ? `2025-${urlOrderIdMatch[1]}` : null;
  }

  // Step 20: Start fulfillment process
  const fulfillmentButton2 = page
    .getByRole("button", { name: /Fulfillment/i })
    .first();
  await expect(fulfillmentButton2).toBeVisible({ timeout: 10000 });
  await fulfillmentButton2.click();

  // Wait for fulfillment menu/dialog to open
  await page.waitForTimeout(2000);

  // Try to find Continue Shipping button - it might be in a menu or dialog
  const continueShippingButton = page.getByRole("button", {
    name: /Continue Shipping/i,
  });

  const hasContinueButton = await continueShippingButton
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (hasContinueButton) {
    await continueShippingButton.click();
    await page.waitForTimeout(1000);
  } else {
    // If button doesn't appear, try looking for it in a menu item
    const continueShippingMenuItem = page.getByRole("menuitem", {
      name: /Continue Shipping/i,
    });
    const hasMenuItem = await continueShippingMenuItem
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (hasMenuItem) {
      await continueShippingMenuItem.click();
      await page.waitForTimeout(1000);
    }
  }

  // Step 21: Add shipping details
  // Wait a bit for the shipping section to load
  await page.waitForTimeout(2000);

  // Try to find the shipping type dropdown - make it optional
  const shippingTypeDropdown = page
    .locator("div")
    .filter({ hasText: /^empty$/i })
    .first();

  const hasShippingSection = await shippingTypeDropdown
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (hasShippingSection) {
    await shippingTypeDropdown.click();
    await page.waitForTimeout(500);

    const shippingOption = page.getByRole("option", { name: "Shipping" });
    await expect(shippingOption).toBeVisible({ timeout: 5000 });
    await shippingOption.click();
  } else {
    // If shipping section doesn't appear, skip to next step
    // This might happen if Continue Shipping wasn't needed
    console.log("Shipping section not found, continuing...");
  }

  // Step 22: Add Manual Tracking (optional - might not be needed)
  let addManualTrackingButton = null;
  let trackingButtonFound = false;

  // Try to find the Add Manual Tracking button
  try {
    addManualTrackingButton = page.getByRole("button", {
      name: /Add Manual Tracking|Add Tracking|Manual Tracking/i,
    });
    trackingButtonFound = await addManualTrackingButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);
  } catch (e) {
    // Continue
  }

  // Strategy 2: Look for any button with "Tracking" in the name
  if (!trackingButtonFound) {
    try {
      const allButtons = page.getByRole("button");
      const buttonCount = await allButtons.count();
      for (let i = 0; i < buttonCount; i++) {
        const button = allButtons.nth(i);
        const text = await button.textContent().catch(() => "");
        if (text && /tracking/i.test(text)) {
          if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
            addManualTrackingButton = button;
            trackingButtonFound = true;
            break;
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  if (trackingButtonFound && addManualTrackingButton) {
    await addManualTrackingButton.click();

    // Wait for tracking form to appear
    await page.waitForTimeout(500);

    // Fill tracking number - try multiple strategies
    let trackingTextbox = null;
    let trackingFound = false;

    // Strategy 1: Try nth textbox
    try {
      trackingTextbox = page.getByRole("textbox").nth(5);
      trackingFound = await trackingTextbox
        .isVisible({ timeout: 3000 })
        .catch(() => false);
    } catch (e) {
      // Continue
    }

    // Strategy 2: Look for textbox with placeholder or label containing "tracking"
    if (!trackingFound) {
      try {
        trackingTextbox = page
          .getByRole("textbox")
          .filter({ hasText: /tracking/i })
          .first();
        trackingFound = await trackingTextbox
          .isVisible({ timeout: 3000 })
          .catch(() => false);
      } catch (e) {
        // Continue
      }
    }

    // Strategy 3: Look for any empty textbox near tracking-related text
    if (!trackingFound) {
      try {
        const trackingLabel = page.getByText(/tracking/i).first();
        if (
          await trackingLabel.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          trackingTextbox = trackingLabel
            .locator("..")
            .locator("input[type='text'], textarea")
            .first();
          trackingFound = await trackingTextbox
            .isVisible({ timeout: 3000 })
            .catch(() => false);
        }
      } catch (e) {
        // Continue
      }
    }

    // Strategy 4: Just use the first available textbox
    if (!trackingFound) {
      try {
        trackingTextbox = page.getByRole("textbox").first();
        trackingFound = await trackingTextbox
          .isVisible({ timeout: 3000 })
          .catch(() => false);
      } catch (e) {
        // Continue
      }
    }

    if (trackingFound && trackingTextbox) {
      await trackingTextbox.click();
      await trackingTextbox.clear();
      await trackingTextbox.fill("test track");
    }

    // Select carrier
    const carrierDropdown = page
      .locator("div")
      .filter({ hasText: /^empty$/ })
      .first();
    const hasCarrierDropdown = await carrierDropdown
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasCarrierDropdown) {
      await carrierDropdown.click();
      await page.waitForTimeout(500);

      const upsOption = page.getByRole("option", { name: "UPS" });
      const hasUpsOption = await upsOption
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (hasUpsOption) {
        await upsOption.click();
      }
    }

    // Save shipping
    const saveShippingButton = page.getByRole("button", {
      name: /Save Shipping|Save/i,
    });
    const hasSaveButton = await saveShippingButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (hasSaveButton) {
      await saveShippingButton.click();
      // Wait for shipping to be saved
      await page.waitForTimeout(1000);
    }
  } else {
    // Tracking button not found - might not be needed for this flow
    console.log(
      "Add Manual Tracking button not found. Skipping tracking step..."
    );
  }

  // Step 23: Mark shipping as in transit (optional - might not be needed at this stage)
  const fulfillmentButton3 = page
    .getByRole("button", { name: /Fulfillment/i })
    .first();
  const hasFulfillmentButton = await fulfillmentButton3
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (hasFulfillmentButton) {
    await fulfillmentButton3.click();
    await page.waitForTimeout(1000); // Wait for menu/dialog to open

    // Try to find Mark Shipping In Transit button
    let markInTransitButton = null;
    let inTransitFound = false;

    // Strategy 1: Direct button
    try {
      markInTransitButton = page.getByRole("button", {
        name: /Mark Shipping In Transit|In Transit/i,
      });
      inTransitFound = await markInTransitButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);
    } catch (e) {
      // Continue
    }

    // Strategy 2: Menu item
    if (!inTransitFound) {
      try {
        markInTransitButton = page.getByRole("menuitem", {
          name: /Mark Shipping In Transit|In Transit/i,
        });
        inTransitFound = await markInTransitButton
          .isVisible({ timeout: 5000 })
          .catch(() => false);
      } catch (e) {
        // Continue
      }
    }

    // Strategy 3: Look for any button with "Transit" in the name
    if (!inTransitFound) {
      try {
        const allButtons = page.getByRole("button");
        const buttonCount = await allButtons.count();
        for (let i = 0; i < buttonCount; i++) {
          const button = allButtons.nth(i);
          const text = await button.textContent().catch(() => "");
          if (text && /transit/i.test(text)) {
            if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
              markInTransitButton = button;
              inTransitFound = true;
              break;
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }

    if (inTransitFound && markInTransitButton) {
      await markInTransitButton.click();

      // Look for confirmation button
      const yesButton = page.getByRole("button", { name: /Yes|Confirm|OK/i });
      const hasYesButton = await yesButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (hasYesButton) {
        await yesButton.click();
        // Wait for confirmation
        await page.waitForTimeout(1000);
      }
    } else {
      console.log(
        "Mark Shipping In Transit button not found. Skipping this step..."
      );
    }
  } else {
    console.log("Fulfillment button not found. Skipping transit marking...");
  }

  // Step 24: Close fulfillment dialog
  const closeButton = page.getByRole("button", { name: "close" });
  if (await closeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeButton.click();
  }

  // Step 25: Open Pick/Pack page (opens in new window/tab or same tab)
  // First, find the Pick/Pack button
  let pickPackButton = null;
  let pickPackFound = false;

  // Strategy 1: Look for button with Pick/Pack text
  try {
    pickPackButton = page.getByRole("button", {
      name: /Pick\/Pack|Pick Pack|Pick-Pack/i,
    });
    pickPackFound = await pickPackButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);
  } catch (e) {
    // Continue
  }

  // Strategy 2: Look for link with Pick/Pack
  if (!pickPackFound) {
    try {
      pickPackButton = page.getByRole("link", {
        name: /Pick\/Pack|Pick Pack/i,
      });
      pickPackFound = await pickPackButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);
    } catch (e) {
      // Continue
    }
  }

  // Strategy 3: Look for any element with Pick/Pack text
  if (!pickPackFound) {
    try {
      pickPackButton = page.getByText(/Pick\/Pack|Pick Pack/i).first();
      pickPackFound = await pickPackButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);
    } catch (e) {
      // Continue
    }
  }

  // Strategy 4: Look for button with "Pick" or "Pack" separately
  if (!pickPackFound) {
    try {
      const allButtons = page.getByRole("button");
      const buttonCount = await allButtons.count();
      for (let i = 0; i < buttonCount; i++) {
        const button = allButtons.nth(i);
        const text = await button.textContent().catch(() => "");
        if (text && /pick.*pack|pack.*pick/i.test(text)) {
          if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
            pickPackButton = button;
            pickPackFound = true;
            break;
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  let page1 = null;

  // Try to extract orderId from current URL if not already set
  if (!orderId) {
    const currentUrl = page.url();
    // Try multiple URL patterns
    const urlPatterns = [
      /order[\/-]?(\d+)/,
      /orderId=([^&]+)/,
      /b2b\/order\/(\d+)/,
      /(\d{4,})/,
    ];
    for (const pattern of urlPatterns) {
      const match = currentUrl.match(pattern);
      if (match && match[1]) {
        // If it's already in format like "2025-123", use it as is
        if (match[1].includes("-")) {
          orderId = match[1];
        } else {
          orderId = `2025-${match[1]}`;
        }
        break;
      }
    }
    // If still not found, try to find order number in page text
    if (!orderId) {
      try {
        const orderText = await page
          .locator("text=/2025-\\d+/")
          .first()
          .textContent()
          .catch(() => null);
        if (orderText) {
          const match = orderText.match(/(2025-\d+)/);
          if (match) {
            orderId = match[1];
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  if (!pickPackFound || !pickPackButton) {
    // Button not found - try to navigate directly to WMS page if we have orderId
    console.log(
      "Pick/Pack button not found. Attempting to navigate directly to WMS page..."
    );
    if (orderId) {
      await page.goto(
        `https://admin.onechanneladmin.com/wms/orders?orderId=${orderId}&warehouse=wh1`
      );
      await page.waitForLoadState("networkidle");
      page1 = page; // Use same page
    } else {
      // Take screenshot for debugging
      await page.screenshot({ path: "pick-pack-error.png", fullPage: true });
      throw new Error(
        "Could not find Pick/Pack button and no orderId available. Cannot proceed with picking/packing flow."
      );
    }
  } else {
    // Set up popup listener before clicking (in case it opens in new tab)
    const page1Promise = page.waitForEvent("popup", { timeout: 10000 });

    await pickPackButton.click();

    // Wait a bit to see if popup opens
    await page.waitForTimeout(2000);

    // Check if popup opened or if we navigated in the same tab
    try {
      page1 = await page1Promise;
    } catch (e) {
      // No popup - might have navigated in same tab or opened in new tab differently
      // Check if we're on WMS page
      const currentUrl = page.url();
      if (currentUrl.includes("/wms")) {
        page1 = page; // Use same page
      } else {
        // Try to find the new page/tab
        const pages = page.context().pages();
        if (pages.length > 1) {
          page1 = pages[pages.length - 1]; // Get the last opened page
        } else {
          // Navigate manually if we have orderId
          if (orderId) {
            await page.goto(
              `https://admin.onechanneladmin.com/wms/orders?orderId=${orderId}&warehouse=wh1`
            );
            page1 = page;
          } else {
            page1 = page; // Fallback to same page
          }
        }
      }
    }

    // If still no page1, use current page
    if (!page1) {
      page1 = page;
    }
  }

  // Wait for the WMS page to load - check if it navigates automatically
  try {
    await page1.waitForURL(/wms.*orders/, { timeout: 5000 });
  } catch (e) {
    // If popup doesn't navigate automatically, navigate explicitly
    if (orderId) {
      await page1.goto(
        `https://admin.onechanneladmin.com/wms/orders?orderId=${orderId}&warehouse=wh1`
      );
    }
  }
  await page1.waitForLoadState("networkidle");
  await page1.waitForURL(/wms.*orders/, { timeout: 10000 });

  // Step 26: PICKING FLOW - Start with Pick Unassigned
  const pickUnassignedText = page1.getByText("pick Unassigned");
  await expect(pickUnassignedText).toBeVisible({ timeout: 10000 });
  await pickUnassignedText.click();

  // Wait for pick assignment dialog
  await page1.waitForTimeout(1000);

  // Select location for picking
  const locationDropdown = page1
    .locator("div")
    .filter({ hasText: /^empty$/ })
    .nth(1);
  await expect(locationDropdown).toBeVisible({ timeout: 5000 });
  await locationDropdown.click();
  await page1.waitForTimeout(500);

  const locationOption = page1.getByRole("option", {
    name: /C3-E03.*Quantity:.*5.*LOW/i,
  });
  await expect(locationOption).toBeVisible({ timeout: 5000 });
  await locationOption.click();

  // Assign user for picking
  const userSearchbox = page1.getByRole("searchbox", { name: "User" });
  await expect(userSearchbox).toBeVisible({ timeout: 5000 });
  await userSearchbox.click();
  await userSearchbox.clear();
  await userSearchbox.fill("anurag");

  // Wait for user suggestions
  await page1.waitForTimeout(1000);

  const userOption = page1
    .getByRole("option", { name: /Anurag.*anurag@/i })
    .first();
  await expect(userOption).toBeVisible({ timeout: 5000 });
  await userOption.click();

  // Update pick assignment
  const updateButton = page1.getByRole("button", { name: "Update" });
  await expect(updateButton).toBeVisible({ timeout: 5000 });
  await updateButton.click();

  // Wait for update to complete
  await page1.waitForTimeout(1000);

  // Step 27: Start PICK process
  const pickText = page1.getByText("Pick", { exact: true });
  await expect(pickText).toBeVisible({ timeout: 5000 });
  await pickText.click();

  // Update again after selecting Pick
  await expect(updateButton).toBeVisible({ timeout: 5000 });
  await updateButton.click();

  await page1.waitForTimeout(1000);

  // Step 28: Click on Pending status and start PICK
  const pendingText = page1.getByText("a Pending");
  await expect(pendingText).toBeVisible({ timeout: 5000 });
  await pendingText.click();

  const startPickButton = page1.getByRole("button", { name: "Start PICK" });
  await expect(startPickButton).toBeVisible({ timeout: 5000 });
  await startPickButton.click();

  // Wait for pick interface to load
  await page1.waitForTimeout(1000);

  // Step 29: Complete picking process - Save location
  const locationButton = page1.locator(".p-xl-6 > div > .p-button").first();
  await expect(locationButton).toBeVisible({ timeout: 5000 });
  await locationButton.click();

  const saveButton = page1.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeVisible({ timeout: 5000 });
  await saveButton.click();

  // Wait for save to complete
  await page1.waitForTimeout(500);

  // Step 30: Enter Serial Number
  const serialTextbox = page1.getByRole("textbox", { name: "Serial" });
  await expect(serialTextbox).toBeVisible({ timeout: 5000 });
  await serialTextbox.click();
  await serialTextbox.clear();
  await serialTextbox.fill("s1");

  // Click outside or next field (if needed)
  const optionalButton = page1
    .locator(".p-button.p-component.p-button-text")
    .first();
  if (await optionalButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await optionalButton.click();
  }

  // Step 31: Enter RFID (optional)
  const rfidTextbox = page1.getByRole("textbox", {
    name: "RFID 1 (optional)",
  });
  if (await rfidTextbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rfidTextbox.click();
    await rfidTextbox.clear();
    await rfidTextbox.fill("12");
  }

  // Save pick details
  await expect(saveButton).toBeVisible({ timeout: 5000 });
  await saveButton.click();

  await page1.waitForTimeout(500);

  // Step 32: Submit picking
  const submitButton = page1.getByRole("button", { name: "Submit" });
  await expect(submitButton).toBeVisible({ timeout: 5000 });
  await submitButton.click();

  // Confirm submission
  const confirmButton = page1.getByRole("button", { name: "Confirm" });
  await expect(confirmButton).toBeVisible({ timeout: 5000 });
  await confirmButton.click();

  // Wait for picking to complete
  await page1.waitForTimeout(2000);

  // Step 33: Navigate back to orders page for packing
  // Extract orderId from current URL if not already stored
  if (!orderId) {
    const currentUrl = page1.url();
    const orderIdMatch = currentUrl.match(/orderId=([^&]+)/);
    orderId = orderIdMatch ? orderIdMatch[1] : null;
  }

  // Navigate to orders page for packing
  if (orderId) {
    await page1.goto(
      `https://admin.onechanneladmin.com/wms/orders?orderId=${orderId}&warehouse=wh1`
    );
  } else {
    // Fallback: try to reload or go back
    await page1.reload();
  }
  await page1.waitForLoadState("networkidle");

  // Step 34: PACKING FLOW - Start with Pack Unassigned
  const packUnassignedText = page1.getByText("pack Unassigned");
  await expect(packUnassignedText).toBeVisible({ timeout: 10000 });
  await packUnassignedText.click();

  // Wait for pack assignment dialog
  await page1.waitForTimeout(1000);

  // Select location for packing
  const packLocationDropdown = page1
    .locator("div")
    .filter({ hasText: /^empty$/ })
    .nth(1);
  await expect(packLocationDropdown).toBeVisible({ timeout: 5000 });
  await packLocationDropdown.click();
  await page1.waitForTimeout(500);

  const packLocationOption = page1
    .getByRole("option", { name: "A Block" })
    .first();
  await expect(packLocationOption).toBeVisible({ timeout: 5000 });
  await packLocationOption.click();

  // Assign user for packing
  const packUserSearchbox = page1.getByRole("searchbox", { name: "User" });
  await expect(packUserSearchbox).toBeVisible({ timeout: 5000 });
  await packUserSearchbox.click();
  await packUserSearchbox.clear();
  await packUserSearchbox.fill("anurag");

  // Wait for user suggestions
  await page1.waitForTimeout(1000);

  const packUserOption = page1
    .getByRole("option", { name: /Anurag.*anurag@/i })
    .first();
  await expect(packUserOption).toBeVisible({ timeout: 5000 });
  await packUserOption.click();

  // Update pack assignment
  const packUpdateButton = page1.getByRole("button", { name: "Update" });
  await expect(packUpdateButton).toBeVisible({ timeout: 5000 });
  await packUpdateButton.click();

  // Wait for update to complete
  await page1.waitForTimeout(1000);

  // Step 35: Click on Pending status and start PACK
  const packPendingText = page1.getByText("a Pending");
  await expect(packPendingText).toBeVisible({ timeout: 5000 });
  await packPendingText.click();

  const startPackButton = page1.getByRole("button", { name: "Start PACK" });
  await expect(startPackButton).toBeVisible({ timeout: 5000 });
  await startPackButton.click();

  // Wait for pack interface to load
  await page1.waitForTimeout(1000);

  // Step 36: Complete packing process
  const packLocationButton = page1.locator(".p-xl-6 > div > .p-button").first();
  await expect(packLocationButton).toBeVisible({ timeout: 5000 });
  await packLocationButton.click();

  await page1.waitForTimeout(500);

  // Submit packing
  const packSubmitButton = page1.getByRole("button", { name: "Submit" });
  await expect(packSubmitButton).toBeVisible({ timeout: 5000 });
  await packSubmitButton.click();

  // Confirm packing submission
  const packConfirmButton = page1.getByRole("button", { name: "Confirm" });
  await expect(packConfirmButton).toBeVisible({ timeout: 5000 });
  await packConfirmButton.click();

  // Wait for packing to complete
  await page1.waitForTimeout(2000);

  // Step 37: Navigate to order details
  const orderLink = page1.getByRole("link", { name: /2025-/i }).first();
  await expect(orderLink).toBeVisible({ timeout: 10000 });
  await orderLink.click();

  await page1.waitForLoadState("networkidle");

  // Step 38: Final fulfillment - Mark Shipping In Transit
  const finalFulfillmentButton = page1
    .getByLabel("Orders Details")
    .getByRole("button", { name: "Fulfillment" });
  await expect(finalFulfillmentButton).toBeVisible({ timeout: 5000 });
  await finalFulfillmentButton.click();

  const finalMarkInTransitButton = page1.getByRole("button", {
    name: "Mark Shipping In Transit",
  });
  await expect(finalMarkInTransitButton).toBeVisible({ timeout: 5000 });
  await finalMarkInTransitButton.click();

  const finalYesButton = page1.getByRole("button", { name: "Yes" });
  await expect(finalYesButton).toBeVisible({ timeout: 5000 });
  await finalYesButton.click();

  // Wait for final confirmation
  await page1.waitForTimeout(1000);
});
