#!/usr/bin/env node
/**
 * Apply Playwright results to production QA workbook (Result + Notes).
 * Usage: node scripts/update-production-qa-results.mjs [path-to-results.json]
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const root = path.resolve(import.meta.dirname, "..");
const resultsPath =
  process.argv[2] || path.join(root, "test-results/production-qa-results.json");
const xlsxPaths = [
  path.join(root, "docs/production-qa-usecases.xlsx"),
  "/Users/suraj/Desktop/production-qa-usecases.xlsx",
].filter((p) => fs.existsSync(p));

if (!fs.existsSync(resultsPath)) {
  console.error("Missing results:", resultsPath);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
const byId = new Map();

function walk(suite) {
  for (const spec of suite.specs || []) {
    const m = spec.title?.match(/^(QA-\d+):/);
    if (!m) continue;
    const id = m[1];
    const test = spec.tests?.[0];
    const result = test?.results?.[0];
    const status = result?.status || test?.status || "unknown";
    byId.set(id, {
      status: status === "passed" ? "Passed" : status === "skipped" ? "Skipped" : "Failed",
      reason: result?.error?.message?.split("\n")[0] || "",
    });
  }
  for (const child of suite.suites || []) walk(child);
}

for (const suite of report.suites || []) walk(suite);

const pyPath = path.join(root, "scripts", "_update_production_qa_xlsx.py");
fs.writeFileSync(
  pyPath,
  `import json, sys
from openpyxl import load_workbook
from datetime import date

payload = json.loads(sys.stdin.read())
by_id = payload["byId"]
paths = payload["paths"]
today = date.today().isoformat()

for xlsx in paths:
    wb = load_workbook(xlsx)
    ws = wb["Use Cases"]
    header = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
    try:
        status_col = header.index("Status") + 1
        result_col = header.index("Result") + 1
        notes_col = header.index("Notes") + 1
        date_col = header.index("Date") + 1
    except ValueError as e:
        raise SystemExit(f"Missing column in {xlsx}: {e}")
    for row in ws.iter_rows(min_row=2):
        uid = row[0].value
        if not uid:
            continue
        uid = str(uid).strip()
        info = by_id.get(uid)
        if not info:
            continue
        row[status_col - 1].value = "Done"
        row[result_col - 1].value = info["status"]
        if info.get("reason"):
            row[notes_col - 1].value = info["reason"][:500]
        row[date_col - 1].value = today
    wb.save(xlsx)
    print("updated", xlsx)
`,
);

const payload = JSON.stringify({
  byId: Object.fromEntries(byId),
  paths: xlsxPaths,
});

execSync(`python3 ${JSON.stringify(pyPath)}`, {
  input: payload,
  encoding: "utf8",
  env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || "/tmp/pydeps" },
});

const sheetId = process.env.PRODUCTION_QA_GOOGLE_SHEET_ID;
if (sheetId && process.env.GOOGLE_ACCESS_TOKEN) {
  console.log("Google Sheets update skipped: set up Sheets API batchUpdate separately if needed.");
}

console.log(`Updated ${byId.size} QA rows in ${xlsxPaths.length} workbook(s).`);
