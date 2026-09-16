import { expect } from "@playwright/test";
import {
  fillInputField,
  ensureLoggedInBuyer,
  loginBuyer,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "./oneDirectBuyAuth.js";
import { gotoOneDirectBuy, dismissCookieBanner } from "./oneDirectBuyNav.js";

export function testAddressData(suffix = "") {
  // Keep labels short — long labels are often truncated/rejected by the form.
  const stamp = `${Date.now().toString().slice(-8)}${Math.random()
    .toString(36)
    .slice(2, 5)}`;
  const tag = suffix ? `${suffix}-${stamp}` : stamp;
  return {
    name: "Playwright Test User",
    label: `ODB ${tag}`,
    // Kissimmee FL — near OneDirectBuy ship-from; Chicago ZIPs often return no rates.
    line1: "8 W Darlington Ave",
    line2: "",
    city: "Kissimmee",
    state: "Florida",
    zip: "34746",
    country: "United States",
    phone: "4075550100",
  };
}

/** Dismiss Address added / confirm OK dialogs that block list actions. */
export async function dismissAddressDialogs(page) {
  for (let i = 0; i < 3; i++) {
    const ok = page.getByRole("button", { name: /^OK$/i }).first();
    if (await ok.isVisible({ timeout: 800 }).catch(() => false)) {
      await ok.click({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
      continue;
    }
    break;
  }
}

/** Address card for a unique label (list item). */
export function addressCardByLabel(page, label) {
  return page
    .locator("article.account-addresses__card")
    .filter({ hasText: label })
    .first();
}

/** Guest or logged-out visit to address book → login. */
export async function expectGuestAddressesRedirect(page) {
  await gotoOneDirectBuy(page, "/account/addresses");
  await expect(page).toHaveURL(/\/account\/login/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: /^Welcome back$/i }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Open authenticated address list (`Your Addresses` or new Address hub). */
export async function openAddressesPage(page) {
  await ensureLoggedInBuyer(page);
  await gotoOneDirectBuy(page, "/account/addresses");

  if (page.url().includes("/account/login")) {
    await loginBuyer(
      page,
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.password,
    );
    await gotoOneDirectBuy(page, "/account/addresses");
  }

  await expect(page).not.toHaveURL(/\/account\/login/, { timeout: 15_000 });
  await expect(
    page
      .getByRole("heading", { name: /^Your Addresses$/i })
      .or(page.getByRole("link", { name: /add address/i }))
      .or(page.getByRole("button", { name: /add address/i }))
      .first(),
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Fill shipping/address form fields (account add/edit or checkout-style labels).
 * Live labels: Name *, Label, Address line 1 *, Country *, State / Province *, City *, Zip / Postal code *
 */
export async function fillAddressForm(page, data) {
  await dismissCookieBanner(page);
  await dismissAddressDialogs(page);

  // Live add/edit form ids (account/addresses/add + edit drawer):
  // #address-name, #address-label, #address-line1, #location-country,
  // #location-state, #location-city, #address-zip
  const nameField = page
    .locator("#address-name")
    .or(page.locator("input[name='name']"))
    .or(page.getByPlaceholder(/Full name/i))
    .or(page.getByRole("textbox", { name: /^Name \*$/i }))
    .or(page.getByRole("textbox", { name: /^Name$/i }))
    .filter({ visible: true })
    .first();
  await expect(nameField).toBeVisible({ timeout: 20_000 });
  await fillInputField(nameField, data.name);

  if (data.label != null) {
    const labelField = page
      .locator("#address-label")
      .or(page.locator("input[name='label']"))
      .or(page.getByPlaceholder(/Home,\s*Office/i))
      .filter({ visible: true });
    if (await labelField.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await fillInputField(labelField.first(), data.label);
    }
  }

  const line1 = page
    .locator("#address-line1")
    .or(page.locator("input[name='line1']"))
    .or(page.getByPlaceholder(/Street address/i))
    .or(page.getByRole("textbox", { name: /^Address line 1 \*$/i }))
    .filter({ visible: true })
    .first();
  await fillInputField(line1, data.line1);

  if (data.line2) {
    const line2 = page.locator("#address-line2").or(page.locator("input[name='line2']"));
    if (await line2.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await fillInputField(line2.first(), data.line2);
    }
  }

  const countrySelect = page
    .locator("#location-country")
    .or(page.locator("select[name='country']"))
    .or(page.getByRole("combobox", { name: /^Country/i }))
    .filter({ visible: true })
    .first();
  if (await countrySelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const tag = await countrySelect.evaluate((el) => el.tagName).catch(() => "");
    if (tag === "SELECT") {
      await countrySelect
        .selectOption({ label: data.country })
        .catch(() => countrySelect.selectOption({ value: "US" }))
        .catch(() => countrySelect.selectOption({ label: "US" }))
        .catch(() => {});
    } else {
      await countrySelect.click().catch(() => {});
      const opt = page.getByRole("option", { name: new RegExp(data.country, "i") }).first();
      if (await opt.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await opt.click();
      }
    }
  }

  const stateSelect = page
    .locator("#location-state")
    .or(page.locator("select[name='state']"))
    .or(page.getByRole("combobox", { name: /^State/i }))
    .filter({ visible: true })
    .first();
  if (await stateSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const tag = await stateSelect.evaluate((el) => el.tagName).catch(() => "");
    if (tag === "SELECT") {
      await stateSelect
        .selectOption({ label: data.state })
        .catch(() => stateSelect.selectOption({ label: "FL" }))
        .catch(() => stateSelect.selectOption({ value: "FL" }))
        .catch(() => {});
      await page.waitForTimeout(500);
    } else {
      await stateSelect.click().catch(() => {});
      const opt = page
        .getByRole("option", { name: new RegExp(`^(${data.state}|FL|Florida)$`, "i") })
        .first();
      if (await opt.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await opt.click();
        await page.waitForTimeout(500);
      }
    }
  }

  const city = page
    .locator("#location-city")
    .or(page.locator("input[name='city']"))
    .or(page.getByPlaceholder(/^City$/i))
    .or(page.getByRole("textbox", { name: /^City/i }))
    .or(page.getByRole("combobox", { name: /^City/i }))
    .filter({ visible: true })
    .first();
  await expect(city).toBeVisible({ timeout: 10_000 });
  const cityTag = await city.evaluate((el) => el.tagName).catch(() => "INPUT");
  if (cityTag === "SELECT") {
    await city.selectOption({ label: data.city }).catch(async () => {
      const options = await city.locator("option").allTextContents();
      const pick =
        options.find((o) => new RegExp(`^${data.city}$`, "i").test(o.trim())) ||
        options.find((o) => /kissimmee|springfield|orlando/i.test(o)) ||
        options.find((o) => o && !/select/i.test(o));
      if (!pick) throw new Error(`City combobox has no usable option (wanted ${data.city})`);
      await city.selectOption({ label: pick });
    });
  } else {
    await fillInputField(city, data.city);
  }

  // IMPORTANT: do not use /ZIP/ placeholder broadly — the street autofill
  // placeholder is "Start typing to autofill street, city, ZIP..." and steals the fill.
  const zip = page.locator("#address-zip").or(page.locator("input[name='zip']")).first();
  await zip.scrollIntoViewIfNeeded().catch(() => {});
  await expect(zip).toBeVisible({ timeout: 10_000 });
  await fillInputField(zip, data.zip);

  const phone = page
    .locator("#address-phone, #phone, input[name='phone'], input[type='tel']")
    .or(page.getByRole("textbox", { name: /phone/i }))
    .or(page.getByPlaceholder(/phone/i))
    .first();
  if (await phone.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await fillInputField(phone, data.phone || "4075550100");
  }

  const stillInvalid = page.locator("input:invalid, select:invalid");
  const invalidCount = await stillInvalid.count().catch(() => 0);
  for (let i = 0; i < invalidCount; i++) {
    const field = stillInvalid.nth(i);
    const type = ((await field.getAttribute("type")) || "").toLowerCase();
    const name = ((await field.getAttribute("name")) || (await field.getAttribute("id")) || "").toLowerCase();
    if (type === "tel" || /phone/.test(name)) {
      await fillInputField(field, data.phone || "4075550100").catch(() => {});
    } else if (/zip|postal/.test(name)) {
      await fillInputField(field, data.zip).catch(() => {});
    } else if (/city/.test(name)) {
      await fillInputField(field, data.city).catch(() => {});
    }
  }
}

/** Click primary save CTA on address forms. */
export async function clickSaveAddress(page) {
  const save = page
    .getByRole("button", { name: /^Save Address$/i })
    .or(page.getByRole("button", { name: /^Save address$/i }))
    .or(page.getByRole("button", { name: /^Save changes$/i }))
    .or(page.getByRole("button", { name: /^Save address for checkout$/i }))
    .or(page.getByRole("button", { name: /^Update address$/i }))
    .filter({ visible: true });
  await expect(save.first()).toBeVisible({ timeout: 10_000 });
  await save.first().click();

  const success = page
    .locator(".ant-modal")
    .filter({ hasText: /Address added|Address updated|Your new address/i })
    .or(
      page
        .locator(".ant-notification-notice")
        .filter({ hasText: /Address added|Address updated|saved|success/i }),
    );
  const fieldError = page.locator(".ant-form-item-explain-error");

  await Promise.race([
    success.first().waitFor({ state: "visible", timeout: 25_000 }),
    page.waitForURL(/\/account\/addresses\/?$/, { timeout: 25_000 }),
    fieldError.first().waitFor({ state: "visible", timeout: 25_000 }),
  ]).catch(() => {});

  if (await fieldError.first().isVisible().catch(() => false)) {
    const texts = (await fieldError.allTextContents())
      .map((t) => t.trim())
      .filter(Boolean);
    throw new Error(`Address save blocked by validation: ${texts.slice(0, 8).join("; ")}`);
  }

  if (/\/account\/addresses\/(add|edit)/i.test(page.url())) {
    if (!(await success.first().isVisible().catch(() => false))) {
      const nativeInvalid = page.locator("input:invalid, select:invalid");
      if (await nativeInvalid.first().isVisible().catch(() => false)) {
        throw new Error("Address save blocked by native HTML validation (required field empty)");
      }
      // If save button was clicked and is disabled or in loading state, wait a moment or allow redirect
      const loading = page.locator(".ant-btn-loading, [aria-busy='true']");
      if (await loading.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.waitForURL(/\/account\/addresses\/?$/, { timeout: 10_000 }).catch(() => {});
      }
      if (/\/account\/addresses\/(add|edit)/i.test(page.url()) && !(await success.first().isVisible().catch(() => false))) {
        // Try clicking save once more in case first click was eaten during blur
        if (await save.first().isVisible().catch(() => false)) {
          await save.first().click().catch(() => {});
          await Promise.race([
            success.first().waitFor({ state: "visible", timeout: 8_000 }),
            page.waitForURL(/\/account\/addresses\/?$/, { timeout: 8_000 }),
          ]).catch(() => {});
        }
      }
    }
  }
}

/** Open the edit drawer/panel for an address card with this label. */
export async function openEditAddress(page, label) {
  await dismissAddressDialogs(page);
  await openAddressesPage(page);
  await dismissAddressDialogs(page);

  const card = addressCardByLabel(page, label);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.scrollIntoViewIfNeeded().catch(() => {});

  const edit = card.getByRole("button", { name: /^Edit address$/i });
  await expect(edit).toBeVisible({ timeout: 10_000 });
  await edit.click();

  await expect(
    page
      .getByRole("heading", { name: /^Edit address$/i })
      .or(page.locator("#address-name"))
      .or(page.getByPlaceholder(/Full name/i))
      .first(),
  ).toBeVisible({ timeout: 20_000 });
}

/** Delete the address card with this unique label (handles confirm dialog). */
export async function deleteAddressByLabel(page, label) {
  await dismissAddressDialogs(page);
  await openAddressesPage(page);
  await dismissAddressDialogs(page);

  const card = addressCardByLabel(page, label);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.scrollIntoViewIfNeeded().catch(() => {});

  page.once("dialog", (dialog) => dialog.accept().catch(() => {}));
  const del = card
    .locator("button.account-addresses__action-btn--danger")
    .or(card.getByRole("button", { name: /^Delete$/i }))
    .or(card.getByRole("button", { name: /delete address/i }))
    .first();
  await expect(del).toBeVisible({ timeout: 10_000 });
  await del.click();

  // Live UI: modal "Delete this address?" with Cancel + Delete.
  const confirmModal = page
    .locator(".ant-modal")
    .filter({ hasText: /Delete this address|delete/i })
    .or(page.getByRole("dialog").filter({ hasText: /Delete this address|delete/i }));
  if (await confirmModal.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
    await confirmModal
      .first()
      .getByRole("button", { name: /^Delete$/i })
      .click();
  } else {
    const confirm = page
      .getByRole("button", { name: /^OK$/i })
      .or(page.getByRole("button", { name: /^Yes$/i }))
      .or(page.getByRole("button", { name: /^Confirm$/i }));
    if (await confirm.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirm.first().click({ force: true });
    }
  }

  await expect(confirmModal.first()).toBeHidden({ timeout: 10_000 }).catch(() => {});
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await dismissCookieBanner(page);
  await dismissAddressDialogs(page);
  const leftover = page.locator("article.account-addresses__card").filter({ hasText: label });
  if (await leftover.count() > 0) {
    await openAddressesPage(page);
    await dismissAddressDialogs(page);
    page.once("dialog", (dialog) => dialog.accept().catch(() => {}));
    const again = leftover
      .locator("button.account-addresses__action-btn--danger")
      .or(leftover.getByRole("button", { name: /^Delete$/i }))
      .first();
    if (await again.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await again.click({ force: true });
      const modal2 = page.locator(".ant-modal").filter({ hasText: /Delete/i });
      if (await modal2.first().isVisible({ timeout: 4_000 }).catch(() => false)) {
        await modal2.first().getByRole("button", { name: /^Delete$/i }).click();
      }
    }
  }
  await expect(
    page
      .locator("article.account-addresses__card")
      .filter({ hasText: label })
      .filter({ visible: true }),
  ).toHaveCount(0, { timeout: 20_000 });
}

/** Add a shipping address via the address book Add address CTA. */
export async function addShippingAddress(page, data) {
  await openAddressesPage(page);
  const addCta = page
    .getByRole("link", { name: /add address/i })
    .or(page.getByRole("button", { name: /add address/i }));
  if (await addCta.first().isVisible({ timeout: 8_000 }).catch(() => false)) {
    await addCta.first().click();
  }

  await page
    .waitForURL(/\/account\/addresses\/add/, { timeout: 10_000 })
    .catch(() => {});

  const nameField = page
    .getByPlaceholder("Full name")
    .or(page.getByRole("textbox", { name: /^Name/i }));
  if (
    !/\/account\/addresses\/add/.test(page.url()) &&
    !(await nameField.first().isVisible({ timeout: 5_000 }).catch(() => false))
  ) {
    await gotoOneDirectBuy(page, "/account/addresses/add");
    if (page.url().includes("/account/login")) {
      await loginBuyer(
        page,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.password,
      );
      await gotoOneDirectBuy(page, "/account/addresses/add");
    }
  }

  await expect(
    page
      .getByPlaceholder("Full name")
      .or(page.getByRole("textbox", { name: /^Name/i }))
      .first(),
  ).toBeVisible({ timeout: 30_000 });

  await fillAddressForm(page, data);

  if (data.setDefault) {
    const box = page.getByRole("checkbox", { name: /^Set as default address$/i });
    await expect(box).toBeVisible({ timeout: 10_000 });
    if (!(await box.isChecked())) {
      await box.check();
    }
  }

  await clickSaveAddress(page);
  await dismissAddressDialogs(page);

  // List can lag — refresh then find the unique label card.
  await openAddressesPage(page);
  await dismissAddressDialogs(page);
  const refresh = page
    .getByRole("button", { name: /^Refresh$/i })
    .or(page.getByRole("link", { name: /^Refresh$/i }))
    .or(page.getByText(/^Refresh$/i));
  if (await refresh.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
    await refresh.first().click();
    await page.waitForTimeout(1_500);
  }

  const card = addressCardByLabel(page, data.label);
  if (!(await card.isVisible({ timeout: 8_000 }).catch(() => false))) {
    // Fallback: label may be truncated in the card title — match line1 + name.
    await expect(
      page
        .locator("article.account-addresses__card")
        .filter({ hasText: data.line1 })
        .filter({ hasText: data.name })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(card).toBeVisible({ timeout: 5_000 });
  }
}
