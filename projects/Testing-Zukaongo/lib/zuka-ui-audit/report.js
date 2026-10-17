/**
 * Writes one JSON per audited screen and rebuilds index.html for the run folder.
 */
const fs = require("fs");
const path = require("path");
const { PALETTE } = require("./theme");

const SEV_ORDER = { critical: 0, major: 1, minor: 2, info: 3 };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function auditDir() {
  return process.env.ZUKA_UI_AUDIT_DIR || path.join("test-results", "zuka-ui-audit", "latest");
}

function writePageResult(result) {
  const dir = auditDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${result.slug}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  buildIndex(dir);
  return file;
}

function buildIndex(dir) {
  const pages = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "summary.json").map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  pages.sort((a, b) => a.surface.localeCompare(b.surface) || a.pageName.localeCompare(b.pageName));
  const totals = { critical: 0, major: 0, minor: 0, info: 0 };
  const byRule = {};
  for (const p of pages) {
    for (const f of p.findings) {
      totals[f.severity] = (totals[f.severity] || 0) + 1;
      byRule[f.ruleId] = (byRule[f.ruleId] || 0) + 1;
    }
  }
  const swatches = Object.entries(PALETTE).map(([k, v]) => `<span class="sw"><i style="background:${v}"></i>${k} ${v}</span>`).join("");
  const rows = pages.map((p) => {
    const counts = ["critical", "major", "minor", "info"].map((s) => p.findings.filter((f) => f.severity === s).length);
    const list = [...p.findings].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]).map((f) => `
      <tr class="${f.severity}"><td><b>${esc(f.severity)}</b></td><td>${esc(f.ruleId)}</td><td>${esc(f.message)}</td>
      <td>${esc(f.actual)}</td><td>${esc(f.expected)}</td><td class="sel">${esc(f.element)}</td></tr>`).join("");
    const shot = p.screenshot ? `<a href="${esc(path.basename(p.screenshot))}"><img src="${esc(path.basename(p.screenshot))}" alt="Screenshot of ${esc(p.pageName)}"></a>` : "";
    return `<details${counts[0] + counts[1] ? " open" : ""}><summary><span class="surf">${esc(p.surface)}</span> ${esc(p.pageName)}
      <span class="vp">${esc(p.viewport)}</span> <span class="c critical">${counts[0]}</span><span class="c major">${counts[1]}</span>
      <span class="c minor">${counts[2]}</span><span class="c info">${counts[3]}</span></summary>
      <p class="url">${esc(p.url)} · settled in ${Math.round(p.settleMs)} ms</p>${shot}
      <table><thead><tr><th>Severity</th><th>Rule</th><th>Finding</th><th>Actual</th><th>Expected</th><th>Element</th></tr></thead><tbody>${list || '<tr><td colspan="6">No findings</td></tr>'}</tbody></table></details>`;
  }).join("\n");
  const ruleRows = Object.entries(byRule).sort((a, b) => b[1] - a[1]).map(([r, n]) => `<tr><td>${esc(r)}</td><td>${n}</td></tr>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZUKAongo UI audit</title><style>
:root{--ink:#0F172A;--muted:#475569;--line:#E2E8F0;--action:#C94E00;--paper:#FFF7EF}
body{font-family:"DM Sans",system-ui,sans-serif;color:var(--ink);background:#fff;margin:0;padding:24px;max-width:1280px}
h1{font-size:28px;margin:0 0 4px}.muted{color:var(--muted)}
.tot{display:flex;gap:12px;margin:16px 0}.tot div{border:1px solid var(--line);border-radius:12px;padding:10px 16px}
.tot b{font-size:22px;display:block}.sw{display:inline-flex;align-items:center;gap:4px;margin:2px 10px 2px 0;font-size:12px}
.sw i{width:14px;height:14px;border-radius:4px;border:1px solid var(--line);display:inline-block}
details{border:1px solid var(--line);border-radius:12px;margin:10px 0;padding:8px 14px;background:#fff}
summary{cursor:pointer;font-weight:600}.surf{background:var(--paper);color:var(--action);border-radius:999px;padding:2px 8px;font-size:12px}
.vp{color:var(--muted);font-weight:400;font-size:12px}.c{display:inline-block;min-width:22px;text-align:center;border-radius:999px;font-size:12px;margin-left:4px;padding:1px 6px}
.c.critical,tr.critical td:first-child{background:#FEE2E2;color:#991B1B}.c.major,tr.major td:first-child{background:#FFEDD5;color:#9A3412}
.c.minor,tr.minor td:first-child{background:#FEF9C3;color:#854D0E}.c.info,tr.info td:first-child{background:#F1F5F9;color:#334155}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px}td,th{border-bottom:1px solid var(--line);padding:6px;text-align:left;vertical-align:top}
.sel{font-family:ui-monospace,monospace;font-size:11px;word-break:break-all;max-width:320px}.url{font-size:12px;color:var(--muted);word-break:break-all}
img{max-width:360px;border:1px solid var(--line);border-radius:8px;float:right;margin:0 0 8px 12px}
</style></head><body><h1>ZUKAongo UI / UX theme audit</h1>
<p class="muted">${pages.length} screens · generated ${new Date().toISOString()} · critical findings fail the run; set ZUKA_UI_AUDIT_STRICT=1 to also fail on major.</p>
<div class="tot">${["critical", "major", "minor", "info"].map((s) => `<div class="${s}"><b>${totals[s] || 0}</b>${s}</div>`).join("")}</div>
<details><summary>Theme tokens checked</summary><p>${swatches}</p></details>
<details><summary>Findings by rule</summary><table><tbody>${ruleRows}</tbody></table></details>
${rows}</body></html>`;
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify({ pages: pages.length, totals, byRule }, null, 2));
}

module.exports = { writePageResult, buildIndex, auditDir };
