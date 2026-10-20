import { test } from "@playwright/test";
import {
  DemoDatatablePage,
  VISIBLE_FILTER_COLUMNS,
} from "./demoDatatable.page.js";

test.describe.configure({ mode: "serial", timeout: 300000 });

test("discover three-dot filter overlays", async ({ browser }) => {
  test.skip(
    process.env.DISCOVER_FILTERS !== "1",
    "Set DISCOVER_FILTERS=1 to dump live overlay operators",
  );

  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
  });
  const page = await context.newPage();
  const table = new DemoDatatablePage(page);
  await table.loginAndOpen();

  const report = [];
  for (const column of VISIBLE_FILTER_COLUMNS) {
    try {
      const overlay = await table.openFilter(column);
      const info = await table.inspectOverlay(overlay);
      let operators = [];
      try {
        operators = await table.listOperatorOptions(overlay);
      } catch (err) {
        operators = [`(list failed: ${err.message})`];
      }
      report.push({ column, ...info, operators });
      console.log(`\n=== FILTER ${column} ===`);
      console.log(JSON.stringify({ ...info, operators }, null, 2));
      await table.closeFilter();
    } catch (err) {
      report.push({ column, error: err.message });
      console.log(`\n=== FILTER ${column} FAILED: ${err.message} ===`);
      await table.closeFilter();
    }
  }

  console.log("\n=== DISCOVERY SUMMARY ===");
  console.log(JSON.stringify(report, null, 2));
  await context.close();
});
