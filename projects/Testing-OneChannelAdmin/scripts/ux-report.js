#!/usr/bin/env node
// Builds test-results/.ux/UX-REPORT.md from the step records checkStep() wrote to test-results/.ux/steps.jsonl.
//   node scripts/ux-report.js            # report from the current log
//   node scripts/ux-report.js --reset    # clear the log before a new run
const fs = require("fs");
const path = require("path");
const { UX_LOG, uxReportMarkdown } = require("../tests/support/check-step");

const out = path.join(path.dirname(UX_LOG), "UX-REPORT.md");

if (process.argv.includes("--reset")) {
  fs.rmSync(UX_LOG, { force: true });
  console.log(`cleared ${UX_LOG}`);
  process.exit(0);
}
if (!fs.existsSync(UX_LOG)) {
  console.error(`no step log at ${UX_LOG} — run a flow spec first`);
  process.exit(1);
}
const steps = fs
  .readFileSync(UX_LOG, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  })
  .filter(Boolean);
fs.writeFileSync(out, uxReportMarkdown(steps, { title: "1CA admin UI/UX report" }));
console.log(`${steps.length} steps → ${out}`);
