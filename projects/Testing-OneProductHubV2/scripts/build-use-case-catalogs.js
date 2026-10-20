/**
 * Build per-flow TSV catalogs for the flow-control UI from OPH_USE_CASES.csv.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const csvPath = path.join(ROOT, "docs", "OPH_USE_CASES.csv");
const outDir = path.join(ROOT, "docs", "catalogs");

const FLOW_FILES = {
  1: "flow-01-smoke-auth",
  2: "flow-02-auth-access",
  3: "flow-03-public-pages",
  4: "flow-04-nav-matrices",
  5: "flow-05-admin",
  6: "flow-06-brand",
  7: "flow-07-client",
  8: "flow-08-e2e-journeys",
  9: "flow-09-public-marketing",
  10: "flow-10-auth-hardening",
  11: "flow-11-brand-workspace-actions",
  12: "flow-12-client-workspace-actions",
  13: "flow-13-admin-governance-actions",
  14: "flow-14-e2e-access-request",
};

function parseCsvLine(line) {
  const parts = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

fs.mkdirSync(outDir, { recursive: true });
const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/).slice(1);
const groups = {};

for (const line of lines) {
  const [
    ucId,
    flowId,
    flowName,
    actor,
    useCase,
    status,
    ,
    soft,
    notes,
  ] = parseCsvLine(line);
  const id = Number(flowId);
  if (!groups[id]) groups[id] = [];
  const catalogId = String(soft || "")
    .replace(/\*+$/, "")
    .trim() || ucId;
  const automation = status === "Remaining gap" ? "No" : "Yes";
  const current =
    status === "Existing"
      ? "Working"
      : status === "New script"
        ? "Automated"
        : "Missing";
  const priority = status === "Remaining gap" ? "P2" : "P0";
  groups[id].push({
    catalogId,
    module: flowName,
    actor,
    useCase,
    desc: String(notes || useCase || "").replace(/\t/g, " "),
    priority,
    automation,
    current,
  });
}

const header = [
  "Use Case ID",
  "Module",
  "Actor",
  "Use Case",
  "Description",
  "Priority",
  "Automation",
  "Current Status",
].join("\t");

for (const [id, rows] of Object.entries(groups)) {
  const name = FLOW_FILES[id];
  const body = rows
    .map((r) =>
      [
        r.catalogId,
        r.module,
        r.actor,
        r.useCase,
        r.desc,
        r.priority,
        r.automation,
        r.current,
      ].join("\t"),
    )
    .join("\n");
  fs.writeFileSync(path.join(outDir, `${name}.tsv`), `${header}\n${body}\n`);
  console.log(`${name}: ${rows.length}`);
}
