import { expect } from "@playwright/test";

export const DATATABLE_URL =
  "https://admin.onechanneladmin.com/v2/demo/datatable";

function resolveEmail() {
  const fromEnv = process.env.TEST_LOGIN_EMAIL || process.env.DATATABLE_LOGIN_EMAIL;
  if (fromEnv && fromEnv.includes("@")) return fromEnv;
  return "admin@onechanneladmin.com";
}

function resolvePassword() {
  const fromEnv = process.env.DATATABLE_LOGIN_PASSWORD;
  if (fromEnv && fromEnv.length >= 8 && !/\s/.test(fromEnv)) return fromEnv;
  return "s1VdeF6F4E6RvZo";
}

export const DATATABLE_CREDENTIALS = {
  email: resolveEmail(),
  password: resolvePassword(),
};

export const CHOOSE_VIEW_OPTIONS = [
  "All",
  "Variations",
  "Variants",
  "Bundles Only",
  "Duplicate MPN",
  "Serial No's",
  "Duplicate HCPC",
  "Variations Only",
  "Variants Only",
  "Archive Only",
  "Vendors Only",
  "Add-Ons",
];

export const VISIBLE_FILTER_COLUMNS = [
  "SKU",
  "Title",
  "Channels",
  "Brand",
  "MPN",
  "Cost",
  "UPC",
  "Retail Price",
  "Available QTY",
  "Images",
  "Status",
  "Warehouse",
  "Category",
  "Description",
  "Tags",
  "Website Intake query only",
  "Serialized QTY",
  "Map Price",
  "Flags",
  "Warranty (in years)",
  "Shopify collections",
  "AddOns Count",
  "Fitment Count",
];

export const SORT_HEADERS = [
  "SKU",
  "Title",
  "Brand",
  "MPN",
  "Cost",
  "Retail Price",
  "Available QTY",
  "Status",
  "Warehouse",
  "Website Intake query only",
  "Serialized QTY",
  "Map Price",
  "Shopify collections",
  "Features",
  "OEM",
  "Specifications",
];

/**
 * Page object for the v2 demo products datatable.
 * @param {import('@playwright/test').Page} page
 */
export class DemoDatatablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  refreshButton() {
    return this.page.getByRole("button", { name: "Refresh" });
  }

  manageViewButton() {
    return this.page.getByRole("button", { name: "Manage View" });
  }

  chooseView() {
    return this.page.getByRole("combobox", { name: "Choose View" });
  }

  serialSearch() {
    return this.page.getByRole("textbox", { name: "Serial No. search" });
  }

  columnsButton() {
    return this.page.getByRole("button", { name: "Columns", exact: true });
  }

  exportButton() {
    return this.page.getByRole("button", { name: "Export" });
  }

  addNewButton() {
    return this.page.getByRole("button", { name: "Add New" });
  }

  tab(name) {
    return this.page.getByRole("button", { name, exact: true }).first();
  }

  selectPageCheckbox() {
    return this.page.getByRole("checkbox", { name: "Select page" });
  }

  selectionOptions() {
    return this.page.getByRole("button", { name: "Selection options" });
  }

  prevButton() {
    return this.page.locator("button.oca-dt-page-btn").filter({ hasText: /^Prev$/ });
  }

  nextButton() {
    return this.page.locator("button.oca-dt-page-btn").filter({ hasText: /^Next$/ });
  }

  goToInput() {
    return this.page.getByRole("spinbutton", { name: "Go To" });
  }

  rowsPerPage() {
    return this.page.getByRole("combobox", { name: "Rows per page" });
  }

  skuLinks() {
    return this.page.locator("table a, [role='row'] a").filter({
      hasNotText: /^$/,
    });
  }

  expandRowButtons() {
    return this.page.getByRole("button", { name: "Expand row" });
  }

  rowCheckboxes() {
    return this.page.getByRole("checkbox", { name: /^Select (?!page)/ });
  }

  sortHeader(column) {
    return this.page.getByRole("button", { name: column, exact: true }).first();
  }

  filterButton(column) {
    return this.page.getByRole("button", { name: `Filter ${column}` }).first();
  }

  filterOverlay() {
    const page = this.page;
    return page
      .locator("body")
      .locator('[role="dialog"], [data-radix-popper-content-wrapper], .p-column-filter-overlay, [class*="popover"], [class*="overlay"]')
      .filter({ has: page.getByRole("button", { name: /^apply$/i }) })
      .filter({ hasNot: page.getByRole("heading", { name: "Profile" }) })
      .filter({ hasNot: page.getByRole("heading", { name: "Columns" }) })
      .last();
  }

  columnsOverlay() {
    return this.page
      .locator("div")
      .filter({ has: this.page.getByRole("heading", { name: "Columns" }) })
      .filter({ has: this.page.getByRole("button", { name: "Apply" }) })
      .last();
  }

  async login() {
    await this.page.setViewportSize({ width: 1600, height: 900 });
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.goto(
          "https://admin.onechanneladmin.com/v2/login?returnUrl=%2F",
          { waitUntil: "domcontentloaded" },
        );

        const emailBox = this.page.getByRole("textbox", { name: "Email address" });
        await expect(emailBox).toBeVisible({ timeout: 15000 });
        await emailBox.click();
        await emailBox.fill(DATATABLE_CREDENTIALS.email);

        const passwordBox = this.page
          .getByRole("textbox", { name: "Password" })
          .or(this.page.locator('input[type="password"]'))
          .or(this.page.locator('input[name="password"]'));
        await expect(passwordBox.first()).toBeVisible({ timeout: 10000 });
        await passwordBox.first().click();
        await passwordBox.first().fill(DATATABLE_CREDENTIALS.password);

        await this.page.getByRole("button", { name: "Login" }).click();
        await this.page.waitForURL(
          (url) =>
            /home|dashboard/i.test(url.pathname) && !/login/i.test(url.pathname),
          { timeout: 30000, waitUntil: "domcontentloaded" },
        );
        await this.page.waitForLoadState("domcontentloaded");
        return;
      } catch (err) {
        lastError = err;
        await this.page.waitForTimeout(2000 * attempt);
      }
    }
    throw lastError;
  }

  async openDatatable() {
    const catalogPromise = this.page
      .waitForResponse(
        (res) =>
          /\/inventory\/catalog(\?|$)/.test(res.url()) &&
          res.request().method() === "POST",
        { timeout: 35000 },
      )
      .catch(() => null);

    await this.page.goto(DATATABLE_URL, { waitUntil: "domcontentloaded" });
    await this.dismissBlockingOverlays();
    const allTab = this.page.getByRole("button", { name: "All", exact: true });
    if (await allTab.first().isVisible().catch(() => false)) {
      await allTab.first().click({ force: true }).catch(() => {});
    }
    await catalogPromise;
    await this.dismissBlockingOverlays();
    await this.waitForRows(25000);
    if (!(await this.hasProductRows())) {
      await this.refreshButton().click({ force: true }).catch(() => {});
      await this.waitForRows(20000);
    }
  }

  async loginAndOpen() {
    await this.installClientNameHeader();
    await this.login();
    await this.page.waitForTimeout(1500);
    await this.openDatatable();
  }

  /**
   * v2 catalog APIs require a clientname header. The headed app does not
   * always attach it after a fresh login, which yields 400 Unauthorized clientname.
   */
  async installClientNameHeader() {
    const clientName =
      process.env.DATATABLE_CLIENT_NAME || "oneauto";
    await this.page.route(
      "https://backend.onechanneladmin.com/**",
      async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.continue();
          return;
        }
        const headers = {
          ...route.request().headers(),
          clientname: clientName,
        };
        await route.continue({ headers });
      },
    );
  }

  async dismissBlockingOverlays() {
    for (const name of ["Fitment", "Profile"]) {
      const dialog = this.page.getByRole("dialog", { name });
      if (await dialog.isVisible().catch(() => false)) {
        await dialog
          .getByRole("button", { name: /^(Close|Dismiss|×)$/i })
          .first()
          .click({ force: true, timeout: 2000 })
          .catch(() => {});
        await dialog.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {});
      }
    }
    const backdrop = this.page.locator(
      'button[aria-label="Close"].absolute.inset-0, button[aria-label="Dismiss"], button.absolute.inset-0.bg-black\\/50',
    );
    for (let i = 0; i < 3; i++) {
      const visible = await backdrop.first().isVisible().catch(() => false);
      if (!visible) break;
      await backdrop.first().click({ force: true, timeout: 2000 }).catch(() => {});
      await this.page.waitForTimeout(150);
    }
    if (await this.page.getByRole("dialog").first().isVisible().catch(() => false)) {
      await this.page.evaluate(() => {
        for (const dialog of document.querySelectorAll('[role="dialog"]')) {
          const close = dialog.querySelector(
            'button[aria-label="Close"], button[aria-label="Dismiss"]',
          );
          if (close) close.click();
          else dialog.remove();
        }
      }).catch(() => {});
    }
    await this.page.keyboard.press("Escape").catch(() => {});
  }

  async waitForRows(timeout = 40000) {
    await this.dismissBlockingOverlays();
    await expect(this.refreshButton()).toBeVisible({ timeout: Math.min(timeout, 15000) });
    const expand = this.expandRowButtons().first();
    const skuLink = this.page.getByRole("link", { name: /AIR_/ });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await expand.count()) > 0 || (await skuLink.count()) > 0) {
        await this.waitForLoadingGone(5000);
        return true;
      }
      await this.page.waitForTimeout(400);
    }
    return (await expand.count()) > 0 || (await skuLink.count()) > 0;
  }

  /**
   * Wait only for a full-table spinner overlay, not icon SVGs or layout wrappers.
   * @param {number} timeout
   */
  async waitForLoadingGone(timeout = 12000) {
    if (this.page.isClosed()) return;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (this.page.isClosed()) return;
      const blocking = await this.page
        .evaluate(() => {
          const isShown = (el) => {
            if (!el) return false;
            const style = getComputedStyle(el);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              Number(style.opacity) < 0.1
            ) {
              return false;
            }
            const box = el.getBoundingClientRect();
            return box.width > 160 && box.height > 80;
          };
          const overlays = document.querySelectorAll(
            ".p-datatable-loading-overlay, .p-datatable-mask, [aria-busy='true']",
          );
          if ([...overlays].some(isShown)) return true;
          for (const spin of document.querySelectorAll(".animate-spin")) {
            const host = spin.closest(
              "div.absolute.inset-0, .p-datatable-loading-overlay, .p-datatable-mask",
            );
            if (isShown(host)) return true;
          }
          return false;
        })
        .catch(() => false);
      if (!blocking) return;
      await this.page.waitForTimeout(200);
    }
  }

  async hasProductRows() {
    if ((await this.expandRowButtons().count()) > 0) return true;
    const skuLink = this.page.getByRole("link", { name: /AIR_|[A-Z0-9_]{4,}/ });
    if ((await skuLink.count()) > 0) return true;
    return this.page.locator("table tbody a").first().isVisible().catch(() => false);
  }

  async restoreDefaultView() {
    await this.dismissBlockingOverlays();
    const allTab = this.tab("All");
    if (await allTab.isVisible().catch(() => false)) {
      await allTab.click({ force: true }).catch(() => {});
    }
    if (await this.chooseView().isVisible().catch(() => false)) {
      await this.chooseViewValue("All").catch(() => {});
    }
    await this.waitForLoadingGone(10000);
  }

  async resetToCleanState() {
    await this.dismissBlockingOverlays();
    if (!this.page.url().includes("/v2/demo/datatable")) {
      await this.openDatatable();
      return;
    }
    await this.restoreDefaultView();
    if (await this.refreshButton().isVisible().catch(() => false)) {
      await this.refreshButton().click({ force: true }).catch(() => {});
    }
    await this.waitForRows(30000);
    await this.waitForLoadingGone(8000);
  }

  async firstSkuText() {
    const tableLink = this.page.locator("table tbody a").first();
    if (await tableLink.isVisible().catch(() => false)) {
      return ((await tableLink.innerText()) || "").trim();
    }
    const link = this.page.getByRole("link", { name: /AIR_|[A-Z0-9_]{4,}/ }).first();
    if (await link.isVisible().catch(() => false)) {
      return ((await link.innerText()) || "").trim();
    }
    const cell = this.page.locator("table tbody tr td").nth(1);
    if (await cell.isVisible().catch(() => false)) {
      return ((await cell.innerText()) || "").trim();
    }
    return "";
  }

  async visibleSkuTexts(limit = 20) {
    const links = this.page.locator("table tbody a");
    const count = await links.count();
    const values = [];
    for (let i = 0; i < Math.min(count, limit); i++) {
      const text = ((await links.nth(i).innerText()) || "").trim();
      if (text && text.length < 80) values.push(text);
    }
    return values;
  }

  async rowCount() {
    return this.expandRowButtons().count();
  }

  /**
   * Open a column three-dot filter and return the overlay locator.
   * @param {string} column
   */
  async openFilter(column) {
    await this.dismissBlockingOverlays();
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const btn = this.filterButton(column);
        await btn.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
        await expect(btn).toBeVisible({ timeout: 15000 });
        await this.waitForLoadingGone(5000);
        await this.filterButton(column).click({ force: true });
        const overlay = this.filterOverlay();
        await expect(overlay).toBeVisible({ timeout: 8000 });
        return overlay;
      } catch (err) {
        lastError = err;
        await this.closeFilter();
        await this.page.waitForTimeout(600);
      }
    }
    throw lastError;
  }

  async closeFilter() {
    await this.page.keyboard.press("Escape").catch(() => {});
    await this.page.waitForTimeout(200);
    const overlay = this.filterOverlay();
    if (await overlay.isVisible().catch(() => false)) {
      await this.page.mouse.click(8, 8).catch(() => {});
    }
    await this.page.keyboard.press("Escape").catch(() => {});
  }

  /**
   * Dump overlay controls so tests can encode real operators (not guesses).
   * @param {import('@playwright/test').Locator} overlay
   */
  async inspectOverlay(overlay) {
    const text = ((await overlay.innerText().catch(() => "")) || "")
      .replace(/\s+/g, " ")
      .trim();
    const buttons = await overlay.getByRole("button").allInnerTexts();
    const comboboxes = await overlay.getByRole("combobox").allInnerTexts();
    const inputs = await overlay.locator("input, textarea").count();
    const checkboxes = await overlay.getByRole("checkbox").count();
    const options = await overlay.getByRole("option").allInnerTexts().catch(
      () => [],
    );
    return {
      text: text.slice(0, 1500),
      buttons: buttons.map((b) => b.trim()).filter(Boolean),
      comboboxes: comboboxes.map((c) => c.trim()).filter(Boolean),
      inputs,
      checkboxes,
      options: options.map((o) => o.trim()).filter(Boolean),
    };
  }

  async operatorDropdown(overlay) {
    const named = overlay.getByRole("combobox").filter({
      hasNotText: /match/i,
    });
    if ((await named.count()) > 0) {
      return named.first();
    }
    return overlay.getByRole("combobox").first();
  }

  async listOperatorOptions(overlay) {
    const dropdown = overlay.getByRole("combobox").first();
    if ((await dropdown.count()) === 0) {
      const options = await overlay.getByRole("option").allInnerTexts().catch(
        () => [],
      );
      return options.map((o) => o.trim()).filter(Boolean);
    }
    await dropdown.click();
    const listbox = this.page.getByRole("listbox").last();
    const listed = listbox.getByRole("option");
    if (await listed.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const labels = (await listed.allInnerTexts()).map((t) => t.trim());
      await this.page.keyboard.press("Escape").catch(() => {});
      return labels.filter(Boolean);
    }
    const options = this.page.getByRole("option");
    const labels = (await options.allInnerTexts().catch(() => [])).map((t) =>
      t.trim(),
    );
    await this.page.keyboard.press("Escape").catch(() => {});
    return labels.filter(Boolean);
  }

  async selectOptionByLabel(label) {
    const option = this.page.getByRole("option", { name: label, exact: false });
    await expect(option.first()).toBeVisible({ timeout: 8000 });
    await option.first().click();
  }

  async selectOperator(overlay, operatorLabel) {
    const nativeSelect = overlay.locator("select").first();
    if ((await nativeSelect.count()) > 0) {
      await nativeSelect.selectOption({ label: operatorLabel });
      return;
    }
    const dropdown = overlay.getByRole("combobox").first();
    await dropdown.click();
    await this.selectOptionByLabel(operatorLabel);
  }

  async overlayValueInputs(overlay) {
    return overlay.locator(
      "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='search'])",
    );
  }

  async fillFilterValue(overlay, value, index = 0) {
    const spin = overlay.getByRole("spinbutton");
    if ((await spin.count()) > index && (await spin.nth(index).isVisible())) {
      await spin.nth(index).fill(String(value));
      return;
    }
    const box = (await this.overlayValueInputs(overlay)).nth(index);
    await expect(box).toBeVisible({ timeout: 8000 });
    await box.fill("");
    await box.fill(String(value));
  }

  async applyTextFilter(column, operator, value) {
    const overlay = await this.openFilter(column);
    await this.selectOperator(overlay, operator);
    if (value != null && !/empty/i.test(operator)) {
      await this.fillFilterValue(overlay, value);
    }
    await this.clickOverlayAction(overlay, "Apply");
    await this.waitForLoadingGone(8000);
    await this.page.waitForTimeout(300);
  }

  async applyRangeFilter(column, { operator, from, to } = {}) {
    const overlay = await this.openFilter(column);
    if (operator) {
      await this.selectOperator(overlay, operator);
    }
    if (from != null) await this.fillFilterValue(overlay, from, 0);
    if (to != null) {
      const inputs = await this.overlayValueInputs(overlay);
      if ((await inputs.count()) > 1) {
        await this.fillFilterValue(overlay, to, 1);
      }
    }
    await this.clickOverlayAction(overlay, "Apply");
    await this.waitForLoadingGone(8000);
    await this.page.waitForTimeout(300);
  }

  async applyEnumFilter(column, optionLabel) {
    const overlay = await this.openFilter(column);
    const checkbox = overlay.getByRole("checkbox", {
      name: new RegExp(optionLabel, "i"),
    });
    await expect(checkbox.first()).toBeVisible({ timeout: 8000 });
    await checkbox.first().click({ force: true });
    await this.clickOverlayAction(overlay, "Apply");
    await this.waitForLoadingGone(8000);
    await this.page.waitForTimeout(300);
  }

  async chooseViewValue(label) {
    const combo = this.chooseView();
    try {
      await combo.selectOption({ label });
    } catch {
      await combo.click();
      await this.selectOptionByLabel(label);
    }
    await this.waitForLoadingGone(8000);
    await this.page.waitForTimeout(300);
  }

  async clickOverlayAction(overlay, name) {
    const btn = overlay.getByRole("button", { name: new RegExp(name, "i") });
    await expect(btn.first()).toBeVisible({ timeout: 8000 });
    await btn.first().click();
  }

  async applyFilter() {
    const overlay = this.filterOverlay();
    const apply = overlay.getByRole("button", { name: /^apply$/i });
    if (await apply.first().isVisible().catch(() => false)) {
      await apply.first().click();
    } else {
      await this.page.keyboard.press("Enter").catch(() => {});
    }
    await this.page.waitForTimeout(800);
    await this.waitForRows(20000).catch(async () => {
      await this.page.waitForTimeout(1000);
    });
  }

  async clearFilter(column) {
    const overlayVisible = await this.filterOverlay()
      .isVisible()
      .catch(() => false);
    if (!overlayVisible) {
      const btn = this.filterButton(column);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true }).catch(() => {});
      }
    }
    const overlay = this.filterOverlay();
    const clear = overlay.getByRole("button", {
      name: /^(clear|reset|remove)$/i,
    });
    if (await clear.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.filterOverlay()
        .getByRole("button", { name: /^(clear|reset|remove)$/i })
        .first()
        .click({ force: true })
        .catch(() => {});
      await this.waitForLoadingGone(8000);
      await this.page.waitForTimeout(200);
    }
    await this.closeFilter();
  }

  async setRowsPerPage(value) {
    const namedSelect = this.page.locator('select[aria-label="Rows per page"]');
    if ((await namedSelect.count()) > 0) {
      await this.waitForLoadingGone(8000);
      if (await namedSelect.isEnabled().catch(() => false)) {
        await namedSelect.selectOption(String(value));
      } else {
        await namedSelect.selectOption(String(value), { force: true }).catch(() => {});
      }
      await this.page.waitForTimeout(800);
      return;
    }
    const combo = this.rowsPerPage();
    try {
      await combo.selectOption(String(value));
    } catch {
      await combo.click();
      const option = this.page.getByRole("option", { name: String(value), exact: true });
      await expect(option.first()).toBeVisible({ timeout: 8000 });
      await option.first().click();
    }
    await this.page.waitForTimeout(800);
  }

  async openColumnsOverlay() {
    await this.columnsButton().click();
    const heading = this.page.getByRole("heading", { name: "Columns" });
    await expect(heading).toBeVisible({ timeout: 15000 });
    return this.columnsOverlay();
  }

  async setColumnVisible(column, visible) {
    const overlay = await this.openColumnsOverlay();
    const box = overlay.getByRole("checkbox", { name: column }).first();
    await expect(box).toBeVisible({ timeout: 8000 });
    const checked = await box.isChecked().catch(() => false);
    const disabled = await box.isDisabled().catch(() => false);
    if (!disabled && checked !== visible) {
      await box.click({ force: true });
    }
    await overlay.getByRole("button", { name: "Apply" }).click();
    await this.page.waitForTimeout(800);
  }

  async firstRowNumericFromHeader(headerName) {
    const header = this.sortHeader(headerName);
    await header.scrollIntoViewIfNeeded();
    const text = await this.page
      .locator("table tbody tr")
      .first()
      .innerText()
      .catch(() => "");
    const match = String(text).match(/\$?\s*([\d,.]+)/);
    return match ? Number(match[1].replace(/,/g, "")) : null;
  }
}
