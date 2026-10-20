/**
 * Google Sheet → use-case rows (pure parts + one fetch).
 *
 * The sheet holds the DEFINITIONS (what to test, expected result, priority, layer); the database
 * holds the RESULTS of runs. This module reads each configured tab through the sheet's CSV export
 * (the sheet must be shared "anyone with the link can view"), maps the columns of every tab layout
 * the team uses (Main / CRM / Backend / 1CA_Admin_Orders / Mobile App) to one row shape, and drops
 * section-heading rows.
 *
 * Env (never commit the sheet ID — this repo is public):
 *   USECASE_SHEET_ID    the spreadsheet ID (from .../spreadsheets/d/<ID>/edit)
 *   USECASE_SHEET_TABS  comma list of name:gid, e.g. "Main:602444940,Backend:1823207124"
 *
 * Unit tests: node --test server/lib/sheetSync.test.js
 */

/** RFC 4180-ish CSV parser: quotes, "" escapes, newlines inside quotes, CRLF. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** A use-case / test-case ID: ODB-UC-001, 1CA-UC-011, ODB-BE-ADV-001, B2B-MOB-003 … */
const ID_RE = /^\s*([A-Z0-9]+-[A-Z]+(?:-[A-Z]+)?-\d+)\b/i;

/** Header aliases per field (lower-cased, trimmed; first match wins). */
const FIELD_ALIASES = {
  id: ["use case id", "test case id", "id"],
  module: ["module", "area"],
  actor: ["actor"],
  title: ["use case", "test scenario"],
  description: ["description", "steps"],
  preconditions: ["preconditions"],
  expectedResult: ["expected result", "expected result (draft — confirm)", "expected result (draft - confirm)"],
  priority: ["priority"],
  automation: ["automation"],
  currentStatus: ["current onedirectbuy status", "status"],
  layer: ["layer"],
  flow: ["flow"],
  screenshot: ["screenshot"],
  automationStatus: ["automation status"],
  assignedTo: ["assigned to"],
  screen: ["screen / popup"],
  route: ["route"],
};

function headerIndex(header) {
  const norm = header.map((h) => String(h || "").trim().toLowerCase());
  const idx = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    let at = -1;
    for (const a of aliases) {
      at = norm.indexOf(a);
      if (at >= 0) break;
    }
    if (at < 0 && field === "expectedResult") at = norm.findIndex((h) => h.startsWith("expected result"));
    idx[field] = at;
  }
  return idx;
}

/**
 * CSV rows of one tab → use-case rows. Rows without an ID (section headings, blanks) are skipped;
 * duplicate IDs keep the first occurrence.
 */
function mapTabRows(tab, csvRows) {
  if (!Array.isArray(csvRows) || csvRows.length < 2) return [];
  const idx = headerIndex(csvRows[0]);
  if (idx.id < 0) idx.id = 0;
  const get = (r, f) => (idx[f] >= 0 && r[idx[f]] != null ? String(r[idx[f]]).trim() : "");
  const seen = new Set();
  const out = [];
  for (const r of csvRows.slice(1)) {
    const m = ID_RE.exec(r[idx.id] || "");
    if (!m) continue;
    const useCaseId = m[1].toUpperCase();
    if (seen.has(useCaseId)) continue;
    seen.add(useCaseId);
    out.push({
      useCaseId,
      tab,
      module: get(r, "module"),
      actor: get(r, "actor"),
      title: get(r, "title"),
      description: get(r, "description"),
      preconditions: get(r, "preconditions"),
      expectedResult: get(r, "expectedResult"),
      priority: get(r, "priority").toUpperCase(),
      automation: get(r, "automation"),
      currentStatus: get(r, "currentStatus"),
      layer: get(r, "layer"),
      flow: get(r, "flow"),
      screenshot: get(r, "screenshot"),
      automationStatus: get(r, "automationStatus"),
      assignedTo: get(r, "assignedTo"),
      screen: get(r, "screen"),
      route: get(r, "route"),
    });
  }
  return out;
}

/** "Main:602444940, Backend:1823207124" → [{name, gid}] */
function parseTabs(value) {
  return String(value || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const at = p.lastIndexOf(":");
      return at > 0 ? { name: p.slice(0, at).trim(), gid: p.slice(at + 1).trim() } : null;
    })
    .filter((t) => t && t.name && /^\d+$/.test(t.gid));
}

function csvExportUrl(sheetId, gid) {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(String(sheetId || ""))) throw new Error("USECASE_SHEET_ID is not a valid spreadsheet ID");
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

/** Fetch every configured tab; returns { rows, tabs:[{name, rows, error?}] }. */
async function fetchSheetRows({ sheetId, tabs }, fetchImpl = globalThis.fetch) {
  const all = [];
  const report = [];
  for (const t of tabs) {
    try {
      const res = await fetchImpl(csvExportUrl(sheetId, t.gid), { redirect: "follow" });
      const type = String(res.headers?.get?.("content-type") || "");
      if (!res.ok || type.includes("text/html")) {
        throw new Error(`HTTP ${res.status}${type.includes("text/html") ? " (sheet not shared by link?)" : ""}`);
      }
      const rows = mapTabRows(t.name, parseCsv(await res.text()));
      all.push(...rows);
      report.push({ name: t.name, rows: rows.length });
    } catch (err) {
      report.push({ name: t.name, rows: 0, error: String(err.message || err) });
    }
  }
  return { rows: all, tabs: report };
}

module.exports = { parseCsv, ID_RE, headerIndex, mapTabRows, parseTabs, csvExportUrl, fetchSheetRows };
