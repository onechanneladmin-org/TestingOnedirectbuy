// Coverage dashboard: GET /api/usecases/summary (definitions from the Google Sheet, results from runs).
const $ = (id) => document.getElementById(id);
const token = () => localStorage.getItem("odb_api_token") || "";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function toast(msg, isError = false) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3500);
}

async function api(path, opts = {}) {
  const h = { ...(opts.headers || {}) };
  if (token()) h.Authorization = `Bearer ${token()}`;
  const res = await fetch(path, { ...opts, headers: h });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error((data && (data.error || data.raw)) || res.statusText);
  return data;
}

function table(el, head, rows) {
  el.innerHTML = `<thead><tr>${head.map((h) => `<th class="${h.num ? "num" : ""}">${esc(h.label)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${head[i].num ? "num" : ""}">${c}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${head.length}" class="muted">None</td></tr>`}</tbody>`;
}

function tile(value, label) {
  return `<div class="tile"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></div>`;
}

function render(s) {
  $("meta").textContent = s.sheetConfigured
    ? `Sheet last synced: ${s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : "never"} · ${s.all.total} use cases${s.notInSheet ? ` · ${s.notInSheet} IDs seen in runs but not in the sheet` : ""}`
    : "The use-case sheet is not configured (USECASE_SHEET_ID / USECASE_SHEET_TABS in .env). Showing run results only.";
  const a = s.all;
  $("tiles").innerHTML = [
    tile(a.inScope, "use cases in scope"),
    tile(`${s.coverage.p0ExpectedPct}%`, "P0 with expected result"),
    tile(`${s.coverage.p0PassedPct}%`, "P0 passing (latest run)"),
    tile(`${s.coverage.allRunPct}%`, "in scope that have run"),
    tile(a.failed + a.blocked, "failing / blocked now"),
    tile(a.notRun, "never run"),
  ].join("");
  const prioRows = Object.entries(s.byPriority)
    .filter(([, b]) => b.total)
    .map(([p, b]) => [esc(p), b.total, b.inScope, b.withExpected, b.passed, b.failed, b.blocked, b.skipped, b.notRun]);
  prioRows.push(["<b>All</b>", a.total, a.inScope, a.withExpected, a.passed, a.failed, a.blocked, a.skipped, a.notRun]);
  const n = (label) => ({ label, num: true });
  table($("prio"), [{ label: "Priority" }, n("Total"), n("In scope"), n("Expected filled"), n("Passed"), n("Failed"), n("Blocked"), n("Skipped"), n("Not run")], prioRows);
  const sorted = (o) => Object.entries(o || {}).sort((x, y) => y[1] - x[1]);
  table($("layer"), [{ label: "Layer" }, n("Use cases")], sorted(s.byLayer).map(([k, v]) => [esc(k), v]));
  table($("flow"), [{ label: "Flow" }, n("Use cases")], sorted(s.byFlow).map(([k, v]) => [esc(k), v]));
  table(
    $("failing"),
    [{ label: "Use case" }, { label: "Priority" }, { label: "Title" }, { label: "Result" }, { label: "When" }, { label: "Error" }],
    (s.failing || []).map((f) => [
      esc(f.useCaseId),
      esc(f.priority),
      esc(f.title),
      `<span class="pill ${esc(f.status)}">${esc(f.status)}</span>`,
      f.at ? esc(new Date(f.at).toLocaleString()) : "",
      `<span class="muted">${esc(f.error)}</span>`,
    ]),
  );
  $("p0missing").textContent = (s.p0MissingExpected || []).length
    ? `${s.p0MissingExpected.length}: ${s.p0MissingExpected.join(", ")}`
    : "None — every in-scope P0 has an expected result.";
}

async function load() {
  $("error").hidden = true;
  try {
    render(await api("/api/usecases/summary"));
  } catch (err) {
    $("error").hidden = false;
    $("error").textContent = `Could not load coverage: ${err.message}`;
  }
}

$("btnRefresh").addEventListener("click", load);
$("btnSync").addEventListener("click", async () => {
  $("btnSync").disabled = true;
  try {
    const r = await api("/api/usecases/sync", { method: "POST" });
    const bad = r.tabs.filter((t) => t.error);
    toast(`Synced ${r.synced} rows${bad.length ? ` — failed: ${bad.map((t) => `${t.name} (${t.error})`).join(", ")}` : ""}`, bad.length > 0);
    await load();
  } catch (err) {
    toast(err.message, true);
  } finally {
    $("btnSync").disabled = false;
  }
});
// The export link needs the token too when API_TOKEN is set.
$("btnExport").addEventListener("click", async (e) => {
  if (!token()) return;
  e.preventDefault();
  try {
    const res = await fetch("/api/usecases/export.csv", { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) throw new Error(res.statusText);
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: "use-case-results.csv" });
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast(`Export failed: ${err.message}`, true);
  }
});
load();
