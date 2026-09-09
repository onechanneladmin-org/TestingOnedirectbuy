import { expect, test } from "@playwright/test";
import {
  CHOOSE_VIEW_OPTIONS,
  DemoDatatablePage,
  VISIBLE_FILTER_COLUMNS,
} from "./demoDatatable.page.js";
import {
  COLUMN_FILTERS,
  TEXT_COLUMNS,
  textFilterMatches,
  textSeedForOperator,
} from "./filterMatrix.js";

test.describe.configure({ mode: "default" });

test.describe("Advanced demo datatable", () => {
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {DemoDatatablePage} */
  let table;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
    });
    page = await context.newPage();
    table = new DemoDatatablePage(page);
    await table.loginAndOpen();
  });

  test.afterAll(async () => {
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
  });

  test.beforeEach(async () => {
    await table.dismissBlockingOverlays();
  });

  async function requireRows() {
    await table.dismissBlockingOverlays();
    await table.restoreDefaultView();
    if (await table.hasProductRows()) return;
    const catalog = page
      .waitForResponse(
        (res) =>
          /\/inventory\/catalog(\?|$)/.test(res.url()) &&
          res.request().method() === "POST",
        { timeout: 20000 },
      )
      .catch(() => null);
    await table.refreshButton().click({ force: true }).catch(() => {});
    await catalog;
    await table.waitForRows(35000);
    if (await table.hasProductRows()) return;
    test.skip(true, "No product rows loaded for this org / filters");
  }

  test("toolbar controls are visible; Export and Add New are display-only", async () => {
    await expect(table.refreshButton()).toBeVisible();
    await expect(table.manageViewButton()).toBeVisible();
    await expect(table.chooseView()).toBeVisible();
    await expect(table.serialSearch()).toBeVisible();
    await expect(table.columnsButton()).toBeVisible();
    await expect(table.exportButton()).toBeVisible();
    await expect(table.addNewButton()).toBeVisible();
    await expect(table.selectPageCheckbox()).toBeVisible();
    await expect(table.selectionOptions()).toBeVisible();
    await expect(table.prevButton()).toBeVisible();
    await expect(table.nextButton()).toBeVisible();
    await expect(table.goToInput()).toBeVisible();
    await expect(table.rowsPerPage()).toBeVisible();
  });

  test("All / Warehouse / Dropshipping tabs switch and return to All", async () => {
    for (const tabName of ["Warehouse", "Dropshipping", "All"]) {
      const tab = table.tab(tabName);
      if (!(await tab.isVisible().catch(() => false))) continue;
      await tab.click();
      await table.waitForRows(20000).catch(() => {});
      await expect(tab).toBeVisible();
    }
  });

  test("Refresh reloads the table", async () => {
    await table.dismissBlockingOverlays();
    await table.refreshButton().click({ force: true });
    await table.waitForLoadingGone(20000);
    await expect(table.refreshButton()).toBeVisible();
  });

  test("Manage View opens a menu and can be dismissed", async () => {
    await table.manageViewButton().click();
    await page.waitForTimeout(500);
    const expanded = await table.manageViewButton().getAttribute("aria-expanded");
    const menuVisible = await page
      .getByRole("menu")
      .first()
      .isVisible()
      .catch(() => false);
    expect(expanded === "true" || menuVisible).toBeTruthy();
    await page.keyboard.press("Escape");
  });

  test("Choose View covers every option then restores All", async () => {
    for (const option of CHOOSE_VIEW_OPTIONS) {
      await table.chooseViewValue(option);
      await expect(table.chooseView()).toBeVisible();
    }
    await table.restoreDefaultView();
    await table.waitForRows(25000);
    await expect(table.chooseView()).toBeVisible();
  });

  test("Serial No. search accepts input and can be cleared", async () => {
    const box = table.serialSearch();
    await box.click();
    await box.fill("SN-TEST-1");
    await page.keyboard.press("Enter");
    await expect(box).toHaveValue("SN-TEST-1");
    await box.fill("");
    await page.keyboard.press("Enter");
  });

  test("Columns overlay search, toggle Title, Apply, then restore", async () => {
    await table.columnsButton().click();
    await expect(page.getByRole("heading", { name: "Columns" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("searchbox").last()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Select all" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();

    const titleBox = page.getByRole("checkbox", { name: "Title" });
    if (await titleBox.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await titleBox.first().scrollIntoViewIfNeeded();
      const wasChecked = await titleBox.first().isChecked();
      if (wasChecked && !(await titleBox.first().isDisabled().catch(() => false))) {
        await titleBox.first().click({ force: true });
      }
      await page.getByRole("button", { name: "Apply" }).last().click();
      await page.waitForTimeout(800);
      await page.keyboard.press("Escape");

      await table.columnsButton().click();
      await expect(page.getByRole("heading", { name: "Columns" })).toBeVisible();
      const restore = page.getByRole("checkbox", { name: "Title" }).first();
      if (
        (await restore.isVisible().catch(() => false)) &&
        !(await restore.isChecked().catch(() => true))
      ) {
        await restore.click({ force: true });
        await page.getByRole("button", { name: "Apply" }).last().click();
      } else {
        await page.keyboard.press("Escape");
      }
    } else {
      await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
      await page.locator('button[aria-label="Close"]').first().click({ force: true }).catch(() => {});
      await page.keyboard.press("Escape");
    }
    await table.dismissBlockingOverlays();
    await table.restoreDefaultView();
    await expect(table.columnsButton()).toBeVisible();
  });

  test("SKU text operators apply, assert, and clear", async () => {
    test.setTimeout(300000);
    await requireRows();
    const sku = await table.firstSkuText();
    expect(sku.length).toBeGreaterThan(1);
    const operators = ["Contains", "Equals", "Starts With", "Does Not Contain"];
    for (const operator of operators) {
      const seed = textSeedForOperator(sku, operator);
      await table.applyTextFilter("SKU", operator, seed);
      let rows = await table.visibleSkuTexts(15);
      if (!rows.length) {
        await table.waitForLoadingGone(8000);
        rows = await table.visibleSkuTexts(15);
      }
      expect(
        textFilterMatches(operator, seed, rows),
        `SKU ${operator} '${seed}'`,
      ).toBeTruthy();
      await table.clearFilter("SKU");
      await table.waitForLoadingGone(8000);
    }
  });

  test("MPN contains, Cost range, and enum filters", async () => {
    test.setTimeout(300000);
    await requireRows();
    const sku = await table.firstSkuText();
    await table.applyTextFilter("MPN", "Contains", sku.slice(0, 3));
    await table.clearFilter("MPN");

    await table.applyRangeFilter("Cost", { from: 0, to: 999999 });
    expect(await table.hasProductRows()).toBeTruthy();
    await table.clearFilter("Cost");
    await table.applyRangeFilter("Cost", { operator: "Is Not Empty" });
    await table.clearFilter("Cost");
    await table.waitForRows(15000).catch(() => {});
    await table.applyEnumFilter("Status", "Published");
    await table.clearFilter("Status");
    await table.applyEnumFilter("Flags", "NoFlag");
    await table.clearFilter("Flags");
  });

  test("every visible three-dot overlay exposes Clear and Apply", async () => {
    test.setTimeout(300000);
    await requireRows();
    const overlayFailures = [];
    for (const column of VISIBLE_FILTER_COLUMNS) {
      try {
        const overlay = await table.openFilter(column);
        const info = await table.inspectOverlay(overlay);
        const buttons = info.buttons.join(" ").toLowerCase();
        if (!buttons.includes("apply") || !buttons.includes("clear")) {
          overlayFailures.push(`${column}: ${info.buttons.join(",")}`);
        }
        if (!COLUMN_FILTERS[column]) {
          overlayFailures.push(`${column}: missing matrix entry`);
        }
        await table.closeFilter();
      } catch (err) {
        overlayFailures.push(`${column}: ${err.message}`);
        await table.closeFilter();
      }
    }
    expect(overlayFailures, overlayFailures.join("\n")).toEqual([]);
    expect(TEXT_COLUMNS.length).toBeGreaterThan(3);
  });

  test("row expand, selection, and pagination", async () => {
    await requireRows();
    const expand = table.expandRowButtons().first();
    await expect(expand).toBeVisible();
    await table.waitForLoadingGone();
    await expand.click({ force: true });
    await page.waitForTimeout(500);
    const collapse = page.getByRole("button", { name: /collapse row/i }).first();
    if (await collapse.isVisible().catch(() => false)) {
      await collapse.click({ force: true });
    } else {
      await expand.click({ force: true });
    }
    await table.rowCheckboxes().first().click({ force: true });
    await table.selectionOptions().click({ force: true });
    await page.keyboard.press("Escape");

    await expect(table.prevButton()).toBeDisabled();
    await table.setRowsPerPage(100);
    await table.setRowsPerPage(50);
    if (await table.nextButton().isEnabled()) {
      await table.nextButton().click({ force: true });
      await table.waitForLoadingGone();
      await table.prevButton().click({ force: true });
    }

    for (const header of ["SKU", "Cost"]) {
      const btn = table.sortHeader(header);
      if (!(await btn.isVisible().catch(() => false))) continue;
      await table.waitForLoadingGone();
      await btn.click({ force: true }).catch(() => {});
    }
  });
});
