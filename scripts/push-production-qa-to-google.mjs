#!/usr/bin/env node
/**
 * Push QA Result/Notes to Google Sheets (values.batchUpdate).
 * Requires: gcloud auth application-default login
 * Env: PRODUCTION_QA_GOOGLE_SHEET_ID (spreadsheet id)
 *      PRODUCTION_QA_SHEET_NAME (default "Production QA Results")
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const root = path.resolve(import.meta.dirname, "..");
const xlsx = path.join(root, "docs/production-qa-usecases.xlsx");
const sheetId = process.env.PRODUCTION_QA_GOOGLE_SHEET_ID;
const tabName = process.env.PRODUCTION_QA_SHEET_NAME || "Production QA Results";

if (!sheetId) {
  console.error("Set PRODUCTION_QA_GOOGLE_SHEET_ID to the spreadsheet id.");
  process.exit(1);
}

let token = process.env.GOOGLE_ACCESS_TOKEN;
if (!token) {
  try {
    token = execSync("gcloud auth application-default print-access-token", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    console.error("Run: gcloud auth application-default login");
    process.exit(1);
  }
}

const py = `import json, sys
from openpyxl import load_workbook
wb = load_workbook(sys.argv[1], data_only=True)
ws = wb["Use Cases"]
rows = [["ID", "Section", "Priority", "Title", "Result", "Notes", "Date"]]
for r in ws.iter_rows(min_row=2, values_only=True):
    if not r or not r[0]:
        continue
    rows.append([r[0], r[1] or "", r[3] or "", r[4] or "", r[8] or "", r[9] or "", r[11] or ""])
print(json.dumps(rows))
`;

const rows = JSON.parse(
  execSync(`python3 -c ${JSON.stringify(py)} ${JSON.stringify(xlsx)}`, {
    encoding: "utf8",
    env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || "/tmp/pydeps" },
  }).trim(),
);

const tsv = rows.map((r) => r.map((c) => String(c ?? "").replace(/\t/g, " ")).join("\t")).join("\n");
fs.writeFileSync(path.join(root, "reports/production-qa-google-paste.tsv"), tsv + "\n");

const body = {
  valueInputOption: "USER_ENTERED",
  data: [
    {
      range: `'${tabName}'!A1`,
      majorDimension: "ROWS",
      values: rows,
    },
  ],
};

const res = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  },
);

const text = await res.text();
if (!res.ok) {
  console.error("Sheets API error:", res.status, text.slice(0, 500));
  console.log("Fallback TSV saved to reports/production-qa-google-paste.tsv");
  process.exit(1);
}

console.log("Updated Google Sheet tab:", tabName, "rows:", rows.length);
