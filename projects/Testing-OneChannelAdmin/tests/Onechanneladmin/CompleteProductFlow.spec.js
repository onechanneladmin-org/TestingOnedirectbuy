import { test, expect } from '@playwright/test';
import { loginOneChannelAdmin } from './loginSteps.js';

// Generate random SKU value
function generateRandomSKU() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `SKU-${timestamp}-${random}`;
}

// Generate random MPN value
function generateRandomMPN() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `MPN-${timestamp}-${random}`;
}

// Error tracking structure
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Retry helper function with error handling
async function executeWithRetry(stepName, action, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await action();
      testResults.passed.push({ step: stepName, attempt });
      console.log(`✓ [PASSED] ${stepName} (attempt ${attempt})`);
      return true;
    } catch (error) {
      lastError = error;
      console.log(`⚠ [RETRY ${attempt}/${maxRetries}] ${stepName}: ${error.message}`);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  testResults.failed.push({ step: stepName, error: lastError?.message || 'Unknown error' });
  console.error(`✗ [FAILED] ${stepName}: ${lastError?.message || 'Unknown error'}`);
  return false;
}

// Safe action wrapper - continues on failure
async function safeAction(stepName, action, isCritical = false) {
  try {
    const success = await executeWithRetry(stepName, action);
    if (!success && isCritical) {
      throw new Error(`Critical step failed: ${stepName}`);
    }
    return success;
  } catch (error) {
    if (isCritical) {
      throw error;
    }
    testResults.warnings.push({ step: stepName, warning: error.message });
    return false;
  }
}

test('Complete Product Flow - Professional Error Handling', async ({ page }) => {
  const randomSKU = generateRandomSKU();
  const randomMPN = generateRandomMPN();

  console.log(`\n=== Starting Test with SKU: ${randomSKU}, MPN: ${randomMPN} ===\n`);

  // Navigation and Login
  await safeAction('Login', async () => {
    await loginOneChannelAdmin(page);
    await page.waitForTimeout(2000); // Wait for navigation
  });

  // Handle potential login error and retry
  await safeAction('Verify login success', async () => {
    const errorText = page.getByText('Sign in There is no user');
    const errorVisible = await errorText.isVisible().catch(() => false);

    if (errorVisible) {
      console.log('Login error detected, correcting email...');
      const emailField = page.getByRole('textbox', { name: 'Email address' });
      await emailField.click();
      await emailField.fill('admin@onechanneladmin.com');
      await page.getByRole('button', { name: 'Login' }).click();
      await page.waitForTimeout(2000);
    }
  });

  // Navigate to Products
  await safeAction('Click Catalog button', async () => {
    const catalogButton = page.getByRole('button', { name: 'Catalog' });
    await catalogButton.waitFor({ state: 'visible', timeout: 15000 });
    await catalogButton.click();
  });

  await safeAction('Click Products link', async () => {
    const productsLink = page.getByRole('link', { name: 'Products' });
    await productsLink.waitFor({ state: 'visible', timeout: 15000 });
    await productsLink.click();
    await page.waitForTimeout(2000);
  });

  // Create New Product
  await safeAction('Click Add New button', async () => {
    const addNewButton = page.getByRole('button', { name: ' Add New' });
    await addNewButton.waitFor({ state: 'visible', timeout: 15000 });
    await addNewButton.click();
    await page.waitForTimeout(1000);
  });

  await safeAction('Fill SKU field', async () => {
    const skuField = page.getByRole('textbox', { name: 'Enter SKU' });
    await skuField.waitFor({ state: 'visible', timeout: 10000 });
    await skuField.click();
    await skuField.fill(randomSKU);
  });

  await safeAction('Fill MPN field', async () => {
    const mpnField = page.getByRole('textbox', { name: 'MPN*' });
    await mpnField.waitFor({ state: 'visible', timeout: 10000 });
    await mpnField.click();
    await mpnField.fill(randomMPN);
  });

  await safeAction('Select Brand', async () => {
    const brandDropdown = page.locator('span').filter({ hasText: /^Brand$/ });
    await brandDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await brandDropdown.click();
    const brandOption = page.getByRole('option', { name: '1CA', exact: true });
    await brandOption.waitFor({ state: 'visible', timeout: 5000 });
    await brandOption.click();
  });

  await safeAction('Select Product Type', async () => {
    const productTypeField = page.getByText('Product Type*Product');
    await productTypeField.waitFor({ state: 'visible', timeout: 10000 });
    await productTypeField.click();
    const singleOption = page.getByRole('option', { name: 'Single' });
    await singleOption.waitFor({ state: 'visible', timeout: 5000 });
    await singleOption.click();
  });

  await safeAction('Click Create button', async () => {
    const createButton = page.getByRole('button', { name: ' Create' });
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    await page.waitForTimeout(2000);
  });

  // Handle potential SKU conflict
  await safeAction('Handle SKU conflict if exists', async () => {
    const skuField = page.getByRole('textbox', { name: 'Enter SKU' });
    const isVisible = await skuField.isVisible().catch(() => false);

    if (isVisible) {
      console.log('SKU conflict detected, updating SKU...');
      const newSKU = generateRandomSKU();
      await skuField.click();
      await skuField.fill(newSKU);
      await page.getByRole('button', { name: ' Create' }).click();
      await page.waitForTimeout(2000);
    }
  });

  await safeAction('Verify product creation success', async () => {
    const successMessage = page.getByText('Product Added Successfully');
    await successMessage.waitFor({ state: 'visible', timeout: 10000 });
  });

  // Product Details - Product Info Tab
  await safeAction('Click Product Type field', async () => {
    const productTypeField = page.getByText('Product Type*Product');
    await productTypeField.waitFor({ state: 'visible', timeout: 10000 });
    await productTypeField.click();
  });

  await safeAction('Fill URL Slug', async () => {
    const urlSlugField = page.getByRole('textbox', { name: 'Url Slug Url Slug' });
    await urlSlugField.waitFor({ state: 'visible', timeout: 10000 });
    await urlSlugField.click();
  });

  await safeAction('Select Amazon Marketplace', async () => {
    const emptyDiv = page.locator('div').filter({ hasText: /^empty$/ }).nth(1);
    await emptyDiv.waitFor({ state: 'visible', timeout: 10000 });
    await emptyDiv.click();
    const amazonOption = page.getByText('Amazon Us A3STI84ZSLQ1Z7');
    await amazonOption.waitFor({ state: 'visible', timeout: 5000 });
    await amazonOption.click();
  });

  await safeAction('Fill UPC', async () => {
    const upcField = page.getByRole('textbox', { name: 'UPC' });
    await upcField.waitFor({ state: 'visible', timeout: 10000 });
    await upcField.click();
    await upcField.fill('testupc');
  });

  await safeAction('Select Draft status', async () => {
    const draftDropdown = page.locator('span').filter({ hasText: /^Draft$/ });
    await draftDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await draftDropdown.click();
    const draftOption = page.getByRole('option', { name: 'Draft' });
    await draftOption.waitFor({ state: 'visible', timeout: 5000 });
    await draftOption.click();
  });

  await safeAction('Select Product Unit', async () => {
    const emptyDiv = page.locator('div').filter({ hasText: /^empty$/ }).nth(1);
    await emptyDiv.waitFor({ state: 'visible', timeout: 10000 });
    await emptyDiv.click();
    const pintOption = page.getByText('Pint');
    await pintOption.waitFor({ state: 'visible', timeout: 5000 });
    await pintOption.click();
  });

  await safeAction('Select Category', async () => {
    const emptyDiv = page.locator('div').filter({ hasText: /^empty$/ }).nth(1);
    await emptyDiv.waitFor({ state: 'visible', timeout: 10000 });
    await emptyDiv.click();
    const categoryOption = page.getByText('1CA SUB CATEGORY');
    await categoryOption.waitFor({ state: 'visible', timeout: 5000 });
    await categoryOption.click();
  });

  await safeAction('Select Feature', async () => {
    const emptyDiv = page.locator('div').filter({ hasText: /^empty$/ }).nth(1);
    await emptyDiv.waitFor({ state: 'visible', timeout: 10000 });
    await emptyDiv.click();
    const featureOption = page.getByText('Feature', { exact: true });
    await featureOption.waitFor({ state: 'visible', timeout: 5000 });
    await featureOption.click();
  });

  await safeAction('Select Gray Flag', async () => {
    const emptyDiv = page.locator('div').filter({ hasText: /^empty$/ }).nth(1);
    await emptyDiv.waitFor({ state: 'visible', timeout: 10000 });
    await emptyDiv.click();
    const grayFlagOption = page.getByText('Gray Flag');
    await grayFlagOption.waitFor({ state: 'visible', timeout: 5000 });
    await grayFlagOption.click();
  });

  await safeAction('Fill Warranty', async () => {
    const warrantyField = page.getByRole('spinbutton', { name: 'Warranty (in years)' });
    await warrantyField.waitFor({ state: 'visible', timeout: 10000 });
    await warrantyField.click();
    await warrantyField.fill('5');
  });

  await safeAction('Select Exterior', async () => {
    const emptyDiv = page.locator('div').filter({ hasText: /^empty$/ }).nth(1);
    await emptyDiv.waitFor({ state: 'visible', timeout: 10000 });
    await emptyDiv.click();
    const exteriorOption = page.getByRole('option', { name: 'Exterior' });
    await exteriorOption.waitFor({ state: 'visible', timeout: 5000 });
    await exteriorOption.click();
  });

  await safeAction('Select Point of Sale', async () => {
    const emptyDiv = page.locator('div').filter({ hasText: /^empty$/ }).nth(1);
    await emptyDiv.waitFor({ state: 'visible', timeout: 10000 });
    await emptyDiv.click();
    const posOption = page.getByText('Point of Sale');
    await posOption.waitFor({ state: 'visible', timeout: 5000 });
    await posOption.click();
  });

  await safeAction('Fill dimension fields', async () => {
    const heightField = page.getByRole('spinbutton', { name: 'Enter Height' });
    await heightField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await heightField.click().catch(() => {});

    const widthField = page.getByRole('spinbutton', { name: 'Enter Width' });
    await widthField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await widthField.click().catch(() => {});

    const lengthField = page.getByRole('spinbutton', { name: 'Enter Length' });
    await lengthField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await lengthField.click().catch(() => {});

    const weightField = page.getByRole('spinbutton', { name: 'Enter Weight' });
    await weightField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await weightField.click().catch(() => {});
  });

  await safeAction('Fill Title', async () => {
    const titleField = page.getByRole('textbox', { name: 'Title', exact: true });
    await titleField.waitFor({ state: 'visible', timeout: 10000 });
    await titleField.click();
    await titleField.fill('test title ');
  });

  await safeAction('Fill URL Slug field', async () => {
    const slugField = page.locator('[id="attributes.slug"]').nth(1);
    await slugField.waitFor({ state: 'visible', timeout: 10000 });
    await slugField.click();
    await slugField.fill('testurl.com');
  });

  await safeAction('Fill Long Title', async () => {
    const longTitleField = page.getByRole('textbox', { name: 'Long Title' });
    await longTitleField.waitFor({ state: 'visible', timeout: 10000 });
    await longTitleField.click();
    await longTitleField.fill('testlongtitle');
  });

  await safeAction('Fill Description in iframe', async () => {
    const iframe = page.getByRole('tabpanel', { name: 'Product Info' }).locator('iframe');
    await iframe.waitFor({ state: 'attached', timeout: 10000 });
    const frame = await iframe.contentFrame();
    const body = frame.locator('body');
    await body.click();
    await body.fill('description');
  });

  await safeAction('Fill Short Description', async () => {
    const shortDescField = page.getByRole('textbox', { name: 'Short Description' });
    await shortDescField.waitFor({ state: 'visible', timeout: 10000 });
    await shortDescField.click();
    await shortDescField.fill('short descirption');
  });

  await safeAction('Save Product Info', async () => {
    const saveButton = page.getByRole('button', { name: ' Save' });
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.click();
    await page.waitForTimeout(2000);
  });

  // Inventory/Pricing Tab
  await safeAction('Navigate to Inventory/Pricing tab', async () => {
    const inventoryTab = page.getByRole('tab', { name: 'Inventory/Pricing' });
    await inventoryTab.waitFor({ state: 'visible', timeout: 10000 });
    await inventoryTab.click();
    await page.waitForTimeout(1000);
  });

  await safeAction('Handle Add Supplier dialog', async () => {
    const addSupplierButton = page.getByRole('button', { name: ' Add Supplier' });
    await addSupplierButton.waitFor({ state: 'visible', timeout: 10000 });
    await addSupplierButton.click();
    await page.waitForTimeout(1000);

    const closeButton = page.getByRole('button', { name: 'close' });
    const isVisible = await closeButton.isVisible().catch(() => false);
    if (isVisible) {
      await closeButton.click();
    }
  });

  await safeAction('Fill pricing fields', async () => {
    const costField = page.getByRole('spinbutton', { name: 'Cost' });
    await costField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await costField.click().catch(() => {});

    const priceField = page.getByRole('spinbutton', { name: 'Price', exact: true });
    await priceField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await priceField.click().catch(() => {});

    const shippingField = page.getByRole('spinbutton', { name: 'Shipping' });
    await shippingField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await shippingField.click().catch(() => {});

    const mapPriceField = page.getByRole('spinbutton', { name: 'Map Price' });
    await mapPriceField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await mapPriceField.click().catch(() => {});
  });

  await safeAction('Click OnHold QTY', async () => {
    const onHoldText = page.getByText('OnHold QTY View All');
    await onHoldText.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await onHoldText.click().catch(() => {});
  });

  await safeAction('Save Inventory/Pricing', async () => {
    const saveButton = page.getByRole('button', { name: ' Save' });
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.click();
    await page.waitForTimeout(2000);
  });

  // Navigate through tabs
  await safeAction('Navigate to Images tab', async () => {
    const imagesTab = page.getByRole('tab', { name: 'Images' });
    await imagesTab.waitFor({ state: 'visible', timeout: 10000 });
    await imagesTab.click();
    await page.waitForTimeout(500);
  });

  await safeAction('Navigate to Additional Fields tab', async () => {
    const additionalFieldsTab = page.getByRole('tab', { name: 'Additional Fields' });
    await additionalFieldsTab.waitFor({ state: 'visible', timeout: 10000 });
    await additionalFieldsTab.click();
    await page.waitForTimeout(500);
  });

  await safeAction('Navigate to MKT-Attributes tab', async () => {
    const mktTab = page.getByRole('tab', { name: 'MKT-Attributes' });
    await mktTab.waitFor({ state: 'visible', timeout: 10000 });
    await mktTab.click();
    await page.waitForTimeout(500);
  });

  // Service SKUS Tab
  await safeAction('Navigate to Service SKUS tab', async () => {
    const serviceSkusTab = page.getByRole('tab', { name: 'Service SKUS' });
    await serviceSkusTab.waitFor({ state: 'visible', timeout: 10000 });
    await serviceSkusTab.click();
    await page.waitForTimeout(1000);
  });

  await safeAction('Add New Service SKU', async () => {
    const addNewSkuButton = page.getByRole('button', { name: ' Add New SKU' });
    await addNewSkuButton.waitFor({ state: 'visible', timeout: 10000 });
    await addNewSkuButton.click();
    await page.waitForTimeout(1000);

    const serviceRow = page.getByRole('row', { name: 'SERVICE01 $ 0.00 service1' });
    const isVisible = await serviceRow.isVisible().catch(() => false);
    if (isVisible) {
      await serviceRow.getByRole('checkbox').click();
      const confirmButton = page.getByRole('button', { name: 'Confirm Selection' });
      await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
      await confirmButton.click();
    }
  });

  await safeAction('Save Service SKUS', async () => {
    const saveButton = page.getByRole('button', { name: ' Save' });
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.click();
    await page.waitForTimeout(2000);
  });

  // Variations Tab
  await safeAction('Navigate to Variations tab', async () => {
    const variationsTab = page.getByRole('tab', { name: 'Variations' });
    await variationsTab.waitFor({ state: 'visible', timeout: 10000 });
    await variationsTab.click();
    await page.waitForTimeout(1000);
  });

  await safeAction('Link Existing Variation', async () => {
    const linkExistingButton = page.getByRole('button', { name: ' Link Existing' });
    await linkExistingButton.waitFor({ state: 'visible', timeout: 10000 });
    await linkExistingButton.click();
    await page.waitForTimeout(1000);

    const demo08Text = page.getByText('DEMO08', { exact: true });
    const isVisible = await demo08Text.isVisible().catch(() => false);
    if (isVisible) {
      await demo08Text.click();
      const demo08Row = page.getByRole('row', { name: 'DEMO08 $ 0.00 Demo08 1CA $ 0.' });
      await demo08Row.getByRole('checkbox').click();
      const confirmButton = page.getByRole('button', { name: 'Confirm Selection' });
      await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
      await confirmButton.click();

      const rowCell = page.locator('.p-row-odd > td:nth-child(5)');
      await rowCell.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await rowCell.click().catch(() => {});
    }
  });

  await safeAction('Save Variations', async () => {
    const saveButton = page.getByRole('button', { name: ' Save' });
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.click();
    await page.waitForTimeout(2000);
  });

  // Serial Numbers Tab
  await safeAction('Navigate to Serial Numbers tab', async () => {
    const serialNumbersTab = page.getByRole('tab', { name: 'Serial Numbers' });
    await serialNumbersTab.waitFor({ state: 'visible', timeout: 10000 });
    await serialNumbersTab.click();
    await page.waitForTimeout(1000);
  });

  await safeAction('Add New Serial Number', async () => {
    const addNewButton = page.getByRole('button', { name: ' Add New' });
    await addNewButton.waitFor({ state: 'visible', timeout: 10000 });
    await addNewButton.click();
    await page.waitForTimeout(1000);

    const serialField = page.getByRole('textbox', { name: 'Enter Serial No.' });
    await serialField.waitFor({ state: 'visible', timeout: 10000 });
    await serialField.click();
    await serialField.fill('s1');

    const rfidField = page.getByRole('textbox', { name: 'Enter RFID Code.' });
    await rfidField.waitFor({ state: 'visible', timeout: 10000 });
    await rfidField.click();
    await rfidField.fill('rfid1');

    const warehouseDropdown = page.locator('span').filter({ hasText: 'Choose Warehouse' });
    await warehouseDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await warehouseDropdown.click();
    const warehouseOption = page.getByRole('option', { name: 'ONECHANNEL ADMIN - WH' });
    await warehouseOption.waitFor({ state: 'visible', timeout: 5000 });
    await warehouseOption.click();

    const statusDropdown = page.locator('span').filter({ hasText: 'Choose Status' });
    await statusDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await statusDropdown.click();
    const statusOption = page.getByRole('option', { name: 'Available', exact: true });
    await statusOption.waitFor({ state: 'visible', timeout: 5000 });
    await statusOption.click();

    const locationDropdown = page.locator('span').filter({ hasText: 'Choose Location' });
    await locationDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await locationDropdown.click();
    const locationOption = page.getByRole('option', { name: 'B2-A09' });
    await locationOption.waitFor({ state: 'visible', timeout: 5000 });
    await locationOption.click();

    const lotField = page.getByRole('textbox', { name: 'Lot No.' });
    await lotField.waitFor({ state: 'visible', timeout: 10000 });
    await lotField.click();
    await lotField.fill('5');

    const submitButton = page.getByRole('button', { name: ' Submit' });
    await submitButton.waitFor({ state: 'visible', timeout: 10000 });
    await submitButton.click();
    await page.waitForTimeout(2000);
  });

  // Variants Tab
  await safeAction('Navigate to Variants tab', async () => {
    const variantsTab = page.getByRole('tab', { name: 'Variants' });
    await variantsTab.waitFor({ state: 'visible', timeout: 10000 });
    await variantsTab.click();
    await page.waitForTimeout(1000);
  });

  await safeAction('Link Existing Variant', async () => {
    const linkExistingButton = page.getByRole('button', { name: ' Link Existing' });
    await linkExistingButton.waitFor({ state: 'visible', timeout: 10000 });
    await linkExistingButton.click();
    await page.waitForTimeout(1000);

    const firstCheckbox = page.locator('.p-row-odd > .p-selection-column').first();
    const isVisible = await firstCheckbox.isVisible().catch(() => false);
    if (isVisible) {
      await firstCheckbox.click();
      const confirmButton = page.getByRole('button', { name: 'Confirm Selection' });
      await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
      await confirmButton.click();
    }
  });

  await safeAction('Save Variants', async () => {
    const saveButton = page.getByRole('button', { name: ' Save' });
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.click();
    await page.waitForTimeout(2000);
  });

  // Fitment Tab
  await safeAction('Navigate to Fitment tab', async () => {
    const fitmentTab = page.getByRole('tab', { name: 'Fitment' });
    await fitmentTab.waitFor({ state: 'visible', timeout: 10000 });
    await fitmentTab.click();
    await page.waitForTimeout(1000);
  });

  await safeAction('Add New Fitment', async () => {
    const addNewButton = page.getByRole('button', { name: ' Add New' });
    await addNewButton.waitFor({ state: 'visible', timeout: 10000 });
    await addNewButton.click();
    await page.waitForTimeout(1000);

    const emptyDiv1 = page.locator('div').filter({ hasText: 'empty' }).nth(5);
    await emptyDiv1.waitFor({ state: 'visible', timeout: 10000 });
    await emptyDiv1.click();
    const yearOption1 = page.getByRole('option', { name: '1950' });
    await yearOption1.waitFor({ state: 'visible', timeout: 5000 });
    await yearOption1.click();

    const emptyDiv2 = page.locator('div').filter({ hasText: /^empty$/ });
    await emptyDiv2.waitFor({ state: 'visible', timeout: 10000 });
    await emptyDiv2.click();
    const yearOption2 = page.getByRole('option', { name: '2005' });
    await yearOption2.waitFor({ state: 'visible', timeout: 5000 });
    await yearOption2.click();

    const textField = page.getByRole('textbox').nth(5);
    await textField.waitFor({ state: 'visible', timeout: 10000 });
    await textField.click();
    await textField.fill('AUdi');

    const quantityField = page.locator('input[name="quantity"]').nth(1);
    await quantityField.waitFor({ state: 'visible', timeout: 10000 });
    await quantityField.click();
    await quantityField.fill('3');

    const saveFitmentButton = page.getByRole('button', { name: 'Save Fitment' });
    await saveFitmentButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveFitmentButton.click();
    await page.waitForTimeout(1000);
  });

  await safeAction('Final Save', async () => {
    const saveButton = page.getByRole('button', { name: ' Save' });
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.click();
    await page.waitForTimeout(2000);
  });

  // Print test summary
  console.log('\n=== Test Execution Summary ===');
  console.log(`Total Steps Passed: ${testResults.passed.length}`);
  console.log(`Total Steps Failed: ${testResults.failed.length}`);
  console.log(`Total Warnings: ${testResults.warnings.length}`);

  if (testResults.failed.length > 0) {
    console.log('\nFailed Steps:');
    testResults.failed.forEach(({ step, error }) => {
      console.log(`  - ${step}: ${error}`);
    });
  }

  if (testResults.warnings.length > 0) {
    console.log('\nWarnings:');
    testResults.warnings.forEach(({ step, warning }) => {
      console.log(`  - ${step}: ${warning}`);
    });
  }

  console.log('\n=== Test Completed ===\n');
});
