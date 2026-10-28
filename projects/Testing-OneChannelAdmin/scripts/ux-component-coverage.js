#!/usr/bin/env node
// Roll-up of the UX audit's component coverage and findings across every audited page.
//   node scripts/ux-component-coverage.js        → ux-audit-report/COMPONENT_COVERAGE.md
// Input: ux-audit-report/<page>/{component-coverage.json, findings.json} (written by runFullUxAudit).
const fs = require("fs");
const path = require("path");
const { KINDS } = require("../lib/ui-audit/components");

const root = path.join(process.cwd(), "ux-audit-report");
if (!fs.existsSync(root)) {
  console.error(`no audit output at ${root} — run the ux-audit project first`);
  process.exit(1);
}

const kinds = {};
for (const k of Object.keys(KINDS)) kinds[k] = { pages: 0, found: 0, probed: 0, failed: 0 };
kinds.form = { pages: 0, found: 0, probed: 0, failed: 0 };
const rules = {};
const pages = [];

for (const dir of fs.readdirSync(root)) {
  const covFile = path.join(root, dir, "component-coverage.json");
  const findFile = path.join(root, dir, "findings.json");
  if (!fs.existsSync(covFile) && !fs.existsSync(findFile)) continue;
  const cov = fs.existsSync(covFile) ? JSON.parse(fs.readFileSync(covFile, "utf8")) : {};
  const findings = fs.existsSync(findFile) ? JSON.parse(fs.readFileSync(findFile, "utf8")) : [];
  pages.push({ dir, findings: findings.length, components: Object.values(cov).reduce((s, c) => s + (c.found || 0), 0) });
  for (const [k, c] of Object.entries(cov)) {
    const t = (kinds[k] = kinds[k] || { pages: 0, found: 0, probed: 0, failed: 0 });
    if (c.found) t.pages += 1;
    t.found += c.found || 0;
    t.probed += c.probed || 0;
    t.failed += c.failed || 0;
  }
  for (const f of findings) {
    const r = (rules[f.ruleId] = rules[f.ruleId] || { count: 0, pages: new Set(), severity: f.severity, example: f.message });
    r.count += f.count || 1;
    r.pages.add(dir);
  }
}

const lines = [];
lines.push("# 1CA UX audit — component coverage", "", `Generated ${new Date().toISOString()} · pages audited: ${pages.length}`, "");
lines.push("## Component kinds", "", "| Kind | Pages | Found | Probed | Probes with findings |", "| --- | ---: | ---: | ---: | ---: |");
for (const [k, t] of Object.entries(kinds).sort((a, b) => b[1].pages - a[1].pages)) {
  lines.push(`| ${k} | ${t.pages} | ${t.found} | ${t.probed} | ${t.failed} |`);
}
const never = Object.entries(kinds).filter(([, t]) => !t.found).map(([k]) => k);
lines.push("", `Kinds never found on these pages: ${never.join(", ") || "none"}`, "");
lines.push("## Findings by rule", "", "| Rule | Severity | Count | Pages | Example |", "| --- | --- | ---: | ---: | --- |");
for (const [id, r] of Object.entries(rules).sort((a, b) => b[1].pages.size - a[1].pages.size)) {
  lines.push(`| ${id} | ${r.severity || ""} | ${r.count} | ${r.pages.size} | ${String(r.example || "").replace(/\|/g, "/").slice(0, 120)} |`);
}
lines.push("", "## Pages", "", "| Page | Components | Findings |", "| --- | ---: | ---: |");
for (const p of pages.sort((a, b) => b.findings - a.findings)) lines.push(`| ${p.dir} | ${p.components} | ${p.findings} |`);

const out = path.join(root, "COMPONENT_COVERAGE.md");
fs.writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`${pages.length} pages → ${out}`);
