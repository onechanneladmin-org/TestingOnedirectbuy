/**
 * Pure helpers that join run results to use cases and build the coverage summary.
 * Unit tests: node --test server/lib/useCaseResults.test.js
 */
const { ID_RE } = require("./sheetSync");

const TERMINAL = new Set(["passed", "failed", "skipped", "blocked"]);
const RANK = { failed: 4, blocked: 3, passed: 2, skipped: 1 };

/** "ODB-UC-005-b" / "ODB-UC-005:retry" → "ODB-UC-005"; null when the step is not a use case. */
function baseUseCaseId(stepId) {
  const m = ID_RE.exec(String(stepId || ""));
  return m ? m[1].toUpperCase() : null;
}

/**
 * One result per use case from an occurrence's steps. Several steps can map to one ID:
 * failed > blocked > passed > skipped (any failure fails the use case).
 * @returns {Map<string,{status:string,error:string,stepIds:string[]}>}
 */
function resultsByUseCase(steps) {
  const out = new Map();
  for (const s of steps || []) {
    if (!TERMINAL.has(s.status)) continue;
    const id = baseUseCaseId(s.stepId);
    if (!id) continue;
    const cur = out.get(id);
    if (!cur) {
      out.set(id, { status: s.status, error: s.error || "", stepIds: [s.stepId] });
      continue;
    }
    cur.stepIds.push(s.stepId);
    if (RANK[s.status] > RANK[cur.status]) {
      cur.status = s.status;
      cur.error = s.error || cur.error;
    }
  }
  return out;
}

const isOutOfScope = (uc) => /^n\/a|not in scope/i.test(uc.layer || "") || /not required|later versions/i.test(uc.currentStatus || "");
const lastStatus = (uc) => (uc.lastResult && uc.lastResult.status) || "not run";

/** Coverage summary for the dashboard (all counts derived from the use-case list). */
function summarize(useCases) {
  const prios = ["P0", "P1", "P2", "—"];
  const blank = () => ({ total: 0, inScope: 0, withExpected: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, notRun: 0 });
  const byPriority = Object.fromEntries(prios.map((p) => [p, blank()]));
  const all = blank();
  const byLayer = {};
  const byFlow = {};
  const byTab = {};
  const failing = [];
  const p0MissingExpected = [];
  for (const uc of useCases || []) {
    const p = prios.includes(uc.priority) ? uc.priority : "—";
    const st = lastStatus(uc);
    for (const bucket of [byPriority[p], all]) {
      bucket.total++;
      if (isOutOfScope(uc)) continue;
      bucket.inScope++;
      if (uc.expectedResult) bucket.withExpected++;
      if (st === "passed") bucket.passed++;
      else if (st === "failed") bucket.failed++;
      else if (st === "blocked") bucket.blocked++;
      else if (st === "skipped") bucket.skipped++;
      else bucket.notRun++;
    }
    const lay = uc.layer || "(no layer)";
    byLayer[lay] = (byLayer[lay] || 0) + 1;
    if (uc.flow) byFlow[uc.flow] = (byFlow[uc.flow] || 0) + 1;
    byTab[uc.tab || "(run only)"] = (byTab[uc.tab || "(run only)"] || 0) + 1;
    if (st === "failed" || st === "blocked") failing.push(uc);
    if (p === "P0" && !isOutOfScope(uc) && !uc.expectedResult) p0MissingExpected.push(uc.useCaseId);
  }
  const pick = (uc) => ({
    useCaseId: uc.useCaseId,
    tab: uc.tab,
    priority: uc.priority,
    title: uc.title,
    status: lastStatus(uc),
    at: uc.lastResult && uc.lastResult.at,
    occurrenceId: uc.lastResult && uc.lastResult.occurrenceId,
    error: String((uc.lastResult && uc.lastResult.error) || "").slice(0, 300),
  });
  const order = { P0: 0, P1: 1, P2: 2 };
  failing.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3) || String(a.useCaseId).localeCompare(String(b.useCaseId)));
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    all,
    byPriority,
    coverage: {
      p0ExpectedPct: pct(byPriority.P0.withExpected, byPriority.P0.inScope),
      p0PassedPct: pct(byPriority.P0.passed, byPriority.P0.inScope),
      allRunPct: pct(all.inScope - all.notRun, all.inScope),
    },
    byLayer,
    byFlow,
    byTab,
    failing: failing.slice(0, 200).map(pick),
    p0MissingExpected: p0MissingExpected.slice(0, 500),
  };
}

const csvCell = (v) => {
  const s = String(v == null ? "" : v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of the latest result per use case, to paste back into the sheet (matched on Use Case ID). */
function resultsCsv(useCases) {
  const head = ["Use Case ID", "Tab", "Priority", "Last Result", "Last Run At", "Flow Run", "Flow", "Error"];
  const lines = [head.join(",")];
  for (const uc of useCases || []) {
    const r = uc.lastResult || {};
    lines.push(
      [uc.useCaseId, uc.tab, uc.priority, r.status || "not run", r.at ? new Date(r.at).toISOString() : "", r.occurrenceId || "", r.flowId || "", String(r.error || "").slice(0, 500)]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

module.exports = { baseUseCaseId, resultsByUseCase, summarize, resultsCsv, isOutOfScope };
