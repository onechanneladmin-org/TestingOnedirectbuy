/**
 * Vehicle fitment helpers for OneDirectBuy "Select Vehicle" / garage flow.
 *
 * Live UI (verified on onedirectbuy.com):
 * - Year/Make/Model are <button role="combobox"> with visible text
 *   "Select year" → after pick shows "2020"
 *   Make starts as "Select year first" (disabled), then "Select make"
 *   Model starts as "Select make first" (disabled), then "Select model"
 */
import { expect } from "@playwright/test";
import {
  dismissAssistantOverlay,
  dismissCookieBanner,
  emulateMobileStorefront,
  gotoOneDirectBuy,
  resetDesktopStorefront,
} from "./oneDirectBuyNav.js";

const DEFAULT_TIMEOUT = 20_000;

/** Header garage trigger: "Select Vehicle" or the applied year/make label. */
export function selectVehicleButton(page) {
  return page
    .locator("header")
    .getByRole("button", { name: /Select Vehicle|\d{4}/i })
    .or(page.getByRole("button", { name: /^Select Vehicle$/i }))
    .or(page.getByRole("button", { name: /Change (selected )?vehicle|My Vehicle/i }))
    .or(
      page
        .locator("header button, .header button, .ps-header button")
        .filter({ hasText: /Select Vehicle|\d{4}/i }),
    )
    .first();
}

/**
 * Mobile bottom-nav "Vehicle" control.
 * Prefer DOM class — accessible name can be hidden while the AI chat overlay
 * marks the main tree aria-hidden, and label text often includes newlines.
 */
export function mobileVehicleBarButton(page) {
  return page
    .locator("button.navigation__item")
    .filter({ hasText: /Vehicle/i })
    .or(
      page.locator("button").filter({
        hasText: /^\s*Vehicle\s*$/i,
      }),
    )
    .first();
}

/** True when the garage sheet/panel is open. */
function garageOpenLocator(page) {
  return page
    .getByRole("heading", { name: /^My Vehicles$/i })
    .or(page.getByRole("button", { name: /^Add Vehicle$/i }))
    .or(page.getByText(/No saved vehicles yet/i))
    .or(page.getByText(/Select a vehicle to see compatible parts/i));
}

/**
 * Year control — prefer role=combobox, fall back to button / text filter.
 * Do NOT rely on accessible-name alone; Playwright sometimes misses it.
 */
export function yearCombobox(page) {
  return page
    .locator('[role="combobox"]')
    .filter({ hasText: /^(Select year|\d{4})$/i })
    .or(page.getByRole("button", { name: /^(Select year|\d{4})$/i }))
    .first();
}

export function makeCombobox(page) {
  return page
    .locator('[role="combobox"]')
    .filter({ hasText: /^(Select make|Select year first)$/i })
    .or(
      page.getByRole("button", {
        name: /^(Select make|Select year first)$/i,
      }),
    )
    .first();
}

export function modelCombobox(page) {
  return page
    .locator('[role="combobox"]')
    .filter({ hasText: /^(Select model|Select make first)$/i })
    .or(
      page.getByRole("button", {
        name: /^(Select model|Select make first)$/i,
      }),
    )
    .first();
}

/** Open My Vehicles garage from desktop header. */
export async function openMyVehiclesPanel(page) {
  await resetDesktopStorefront(page);
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);

  if (await garageOpenLocator(page).first().isVisible({ timeout: 2_000 }).catch(() => false)) {
    return;
  }

  const trigger = selectVehicleButton(page);
  await expect(trigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  const expanded = await trigger.getAttribute("aria-expanded").catch(() => null);
  if (expanded !== "true") {
    await trigger.click();
  }
  await expect(garageOpenLocator(page).first()).toBeVisible({ timeout: 15_000 });
}

/** Open Add New Vehicle → Manual entry until Year control is ready. */
export async function openAddNewVehicleForm(page) {
  await openMyVehiclesPanel(page);

  const addBtn = page.getByRole("button", { name: /^Add Vehicle$/i });
  await expect(addBtn).toBeVisible({ timeout: 15_000 });
  await addBtn.click();

  await expect(
    page.getByRole("heading", { name: /^Add New Vehicle$/i }),
  ).toBeVisible({ timeout: 15_000 });

  const manual = page.getByRole("tab", { name: /^Manual entry$/i });
  if (await manual.isVisible().catch(() => false)) {
    const selected = await manual.getAttribute("aria-selected");
    if (selected !== "true") {
      await manual.click();
    }
  }

  await expect(
    page.getByText(/Find parts guaranteed to fit/i),
  ).toBeVisible({ timeout: 15_000 });

  const year = yearCombobox(page);
  await year.scrollIntoViewIfNeeded().catch(() => {});
  await expect(year).toBeVisible({ timeout: DEFAULT_TIMEOUT });
}

/**
 * Cascading Year → Make → Model (first available options unless preferred).
 * @returns {Promise<{ year: string, make: string, model: string }>}
 */
export async function fillVehicleYearMakeModel(page, preferred = {}) {
  const yearCombo = yearCombobox(page);
  await expect(yearCombo).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await yearCombo.click();

  const yearOpt = preferred.year
    ? page.getByRole("option", { name: new RegExp(`^${preferred.year}$`) })
    : page.getByRole("option").filter({ hasText: /^\d{4}$/ }).first();
  await expect(yearOpt).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  const yearName = preferred.year || (await yearOpt.innerText()).trim();
  await page.getByRole("option", { name: new RegExp(`^${yearName}$`) }).click();

  // After year pick, make becomes enabled with name "Select make"
  const makeReady = page
    .locator('[role="combobox"]')
    .filter({ hasText: /^Select make$/i })
    .or(page.getByRole("button", { name: /^Select make$/i }))
    .first();
  await expect(makeReady).toBeEnabled({ timeout: DEFAULT_TIMEOUT });
  await makeReady.click();

  const makeOpt = preferred.make
    ? page.getByRole("option", { name: new RegExp(preferred.make, "i") }).first()
    : page.getByRole("option").first();
  await expect(makeOpt).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  const makeName = (await makeOpt.innerText()).trim();
  await makeOpt.click();

  const modelReady = page
    .locator('[role="combobox"]')
    .filter({ hasText: /^Select model$/i })
    .or(page.getByRole("button", { name: /^Select model$/i }))
    .first();
  await expect(modelReady).toBeEnabled({ timeout: DEFAULT_TIMEOUT });
  await modelReady.click();

  const modelOpt = preferred.model
    ? page.getByRole("option", { name: new RegExp(preferred.model, "i") }).first()
    : page.getByRole("option").first();
  await expect(modelOpt).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  const modelName = (await modelOpt.innerText()).trim();
  await modelOpt.click();

  return { year: yearName, make: makeName, model: modelName };
}

/** Add New Vehicle → Look up by VIN tab. */
export async function openVinLookupTab(page) {
  await openAddNewVehicleForm(page);
  await page.getByRole("tab", { name: /^Look up by VIN$/i }).click();
  await expect(
    page.getByRole("textbox", { name: /VIN \(17 characters\)/i }),
  ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await expect(
    page.getByRole("button", { name: /^Look up VIN$/i }),
  ).toBeVisible();
}

/** Mobile bottom-bar Vehicle → garage panel. */
export async function openVehicleFromMobileBar(page) {
  // Mobile chrome is CSS-width based; reload after resize so layout settles.
  await gotoOneDirectBuy(page, "/");
  await emulateMobileStorefront(page);
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);

  const vehicle = mobileVehicleBarButton(page);
  await expect(vehicle).toBeVisible({ timeout: DEFAULT_TIMEOUT });

  const garage = garageOpenLocator(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await garage.first().isVisible().catch(() => false)) break;
    await dismissAssistantOverlay(page);
    await vehicle.click({ force: true });
    if (await garage.first().isVisible({ timeout: 8_000 }).catch(() => false)) {
      break;
    }
  }

  await expect(garage.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
}

/** Optional trim/engine fields on Add New Vehicle. */
export function trimField(page) {
  return page
    .getByRole("combobox", { name: /Trim/i })
    .or(page.getByRole("textbox", { name: /Trim \(optional\)/i }))
    .or(page.locator("select").filter({ has: page.locator("option", { hasText: /trim/i }) }))
    .or(page.locator("select[name*='trim' i], select#trim"))
    .first();
}

export function engineField(page) {
  return page
    .getByRole("combobox", { name: /Engine/i })
    .or(page.getByRole("textbox", { name: /Engine \(optional\)/i }))
    .or(page.locator("select[name*='engine' i], select#engine"))
    .first();
}

export async function fillOptionalComboOrText(page, locator, value) {
  if (!(await locator.isVisible({ timeout: 3_000 }).catch(() => false))) return;
  const tag = await locator.evaluate((el) => el.tagName).catch(() => "");
  if (tag === "SELECT") {
    await locator
      .selectOption({ label: value })
      .catch(() => locator.selectOption({ index: 1 }))
      .catch(() => {});
    return;
  }
  await locator.click().catch(() => {});
  const opt = page.getByRole("option", { name: new RegExp(value, "i") }).first();
  if (await opt.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await opt.click();
    return;
  }
  await locator.fill(value).catch(() => {});
}

export async function clickFindParts(page) {
  const find = page
    .getByRole("button", { name: /^Find Parts$/i })
    .or(page.getByRole("button", { name: /^Find !$/i }))
    .or(page.getByRole("button", { name: /Find parts/i }))
    .first();
  if (await find.isVisible({ timeout: 5000 }).catch(() => false)) {
    await find.click({ force: true }).catch(() => {});
  }
}

export async function saveVehicleFromForm(page) {
  const save = page.getByRole("button", { name: /^Save Vehicle$/i });
  await expect(save).toBeEnabled({ timeout: 15_000 });
  await save.click();
}

export async function openLicensePlateTab(page) {
  await openAddNewVehicleForm(page);
  const tab = page.getByRole("tab", {
    name: /Look up by (license )?plate|License plate/i,
  });
  if (!(await tab.isVisible({ timeout: 5_000 }).catch(() => false))) {
    throw new Error("License plate lookup tab is not available on Add New Vehicle.");
  }
  await tab.click();
}

export async function submitVinLookup(page, vin) {
  await openVinLookupTab(page);
  const box = page.getByRole("textbox", { name: /VIN \(17 characters\)/i });
  await box.fill(vin);
  await page.getByRole("button", { name: /^Look up VIN$/i }).click();
}

export function fitmentBadge(page) {
  return page.getByText(
    /Fits your vehicle|This (part|product) fits|Does not fit|Not compatible|Fitment/i,
  );
}

export function fitsVehicleMessage(page) {
  return page.getByText(
    /Fits (your )?vehicle|This (part|product) fits|Compatible with your vehicle/i,
  );
}

export function doesNotFitMessage(page) {
  return page.getByText(
    /Does not fit|won'?t fit|will not fit|not compatible|incompatible with your vehicle/i,
  );
}

export function compatibilityCopy(page) {
  return page.getByText(
    /compatible|fitment|fits these vehicles|vehicle (fit|compatibility)|this part fits/i,
  );
}

/** Select YMM on Add New Vehicle, then Find Parts. */
export async function applyYmmAndFindParts(page, preferred = { year: "2020" }) {
  await openAddNewVehicleForm(page);
  const picked = await fillVehicleYearMakeModel(page, preferred);
  await clickFindParts(page);
  return picked;
}

/** Select YMM and Save Vehicle into the device garage. */
export async function saveYmmVehicleToGarage(page, preferred = { year: "2020" }) {
  await openAddNewVehicleForm(page);
  const picked = await fillVehicleYearMakeModel(page, preferred);
  await saveVehicleFromForm(page);
  await page
    .getByText(/vehicle saved|saved to (your )?garage|added (to )?(your )?garage/i)
    .first()
    .waitFor({ state: "visible", timeout: 8_000 })
    .catch(() => {});
  const close = page.getByRole("button", {
    name: /^(Back|Close|Done|Close modal)$/i,
  });
  if (await close.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await close.first().click({ force: true }).catch(() => {});
  }
  const yearInHeader = page
    .locator("header")
    .getByText(new RegExp(String(picked.year)))
    .or(page.getByRole("button", { name: new RegExp(String(picked.year)) }));
  if (await yearInHeader.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
    return picked;
  }
  await openMyVehiclesPanel(page);
  const yearHit = page.getByText(new RegExp(String(picked.year))).first();
  if (!(await yearHit.isVisible({ timeout: 8_000 }).catch(() => false))) {
    await expect(
      page
        .getByRole("button", { name: /^Add Vehicle$/i })
        .or(page.getByRole("heading", { name: /My Vehicles/i }))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  }
  return picked;
}

export function garageVehicleButtons(page) {
  return page
    .getByRole("button")
    .filter({ hasText: /\d{4}/ })
    .filter({ hasNotText: /^Select Vehicle$/i });
}

export async function useFirstSavedVehicle(page) {
  await openMyVehiclesPanel(page);
  const card = garageVehicleButtons(page).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
}

export async function removeFirstSavedVehicle(page) {
  await openMyVehiclesPanel(page);
  const remove = page
    .getByRole("button", { name: /^(Remove|Delete)$/i })
    .or(page.getByRole("button", { name: /remove vehicle|delete vehicle/i }))
    .first();
  if (!(await remove.isVisible({ timeout: 5_000 }).catch(() => false))) {
    throw new Error("No Remove/Delete control on a saved garage vehicle.");
  }
  await remove.click();
}

export async function setDefaultSavedVehicle(page) {
  await openMyVehiclesPanel(page);
  const def = page
    .getByRole("button", { name: /set as default|make default|^default$/i })
    .first();
  if (!(await def.isVisible({ timeout: 5_000 }).catch(() => false))) {
    throw new Error("No Set as default control on a saved garage vehicle.");
  }
  await def.click();
}

export async function clearSelectedVehicle(page) {
  const clear = page
    .getByRole("button", {
      name: /clear (selected )?vehicle|change vehicle|^clear$/i,
    })
    .first();
  if (await clear.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await clear.click();
    return;
  }
  await openMyVehiclesPanel(page);
  const inGarage = page
    .getByRole("button", {
      name: /clear (selected )?vehicle|deselect|change vehicle/i,
    })
    .first();
  if (!(await inGarage.isVisible({ timeout: 5_000 }).catch(() => false))) {
    throw new Error("No Clear selected vehicle control in header or garage.");
  }
  await inGarage.click();
}

export function vinLookupError(page) {
  return page.getByText(
    /invalid vin|could not (decode|find)|vin (not found|is invalid)|unable to (decode|look up)/i,
  );
}

export function vinDecodedVehicle(page) {
  return page
    .getByText(/\d{4}\s+\w+/)
    .or(page.getByRole("button", { name: /use this vehicle|select (this )?vehicle|save vehicle/i }))
    .or(page.getByText(/decoded|vehicle found|we found your vehicle/i));
}
