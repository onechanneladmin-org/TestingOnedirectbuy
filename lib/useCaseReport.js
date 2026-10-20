/**
 * Playwright test results → one result per use-case ID (pure; shared by the server endpoint
 * POST /api/usecases/results, reporters/useCaseResultsReporter.js and the 1CA upload script).
 *
 * Where a test's use-case IDs come from, in order:
 *   1. annotations { type: "usecase-result", description: '{"id":"1CA-UC-011","failed":false}' }
 *      — written by checkStep() for every step, so each ID gets its own step outcome;
 *   2. annotations { type: "usecase", description: "ODB-UC-201" } (Coupons.spec.js pattern);
 *   3. IDs in the test title ("ODB-UC-201 checkout totals").
 * Status per ID:
 *   - step-level (1): its own step failed → failed; else test passed → passed; test failed
 *     elsewhere → blocked; test skipped → skipped;
 *   - test-level (2, 3): passed / failed / skipped; a test that passed only on retry is
 *     "failed" with a "flaky" note (the plan: flaky is reported, never counted as a pass).
 * Several tests can cover one ID: failed > blocked > passed > skipped.
 * Unit tests: node --test lib/useCaseReport.test.js
 */
const ID_RE_G = /\b([A-Z0-9]+-[A-Z]+(?:-[A-Z]+)?-\d+)\b/gi;
const RANK = { failed: 4, blocked: 3, passed: 2, skipped: 1 };

function idsInText(text) {
  const out = [];
  for (const m of String(text || "").matchAll(ID_RE_G)) {
    // must look like a use-case ID (letters-letters-digits), not e.g. "2026-10-20"
    if (/[A-Z]/i.test(m[1].split("-")[1] || "")) out.push(m[1].toUpperCase());
  }
  return out;
}

/** Normalise a Playwright status ("expected"/"unexpected"/"flaky"/"skipped"/"passed"/"failed"/"timedOut"/"interrupted"). */
function testStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "expected" || s === "passed") return "passed";
  if (s === "skipped") return "skipped";
  if (s === "flaky") return "flaky";
  return "failed";
}

/**
 * @param {{title:string,file?:string,project?:string,status:string,error?:string,annotations?:{type:string,description?:string}[]}[]} tests
 * @returns {{useCaseId:string,status:string,error:string,tests:string[]}[]}
 */
function resultsFromTests(tests) {
  const by = new Map();
  const put = (id, status, error, title) => {
    const cur = by.get(id);
    if (!cur) return by.set(id, { useCaseId: id, status, error: error || "", tests: [title] });
    if (!cur.tests.includes(title)) cur.tests.push(title);
    if (RANK[status] > RANK[cur.status]) {
      cur.status = status;
      cur.error = error || cur.error;
    }
  };
  for (const t of tests || []) {
    const title = [t.project, t.file, t.title].filter(Boolean).join(" › ");
    const st = testStatus(t.status);
    const err = String(t.error || "").slice(0, 2000);
    const ann = Array.isArray(t.annotations) ? t.annotations : [];
    const stepRes = [];
    for (const a of ann) {
      if (a.type !== "usecase-result") continue;
      try {
        const v = JSON.parse(a.description || "{}");
        if (v && v.id) stepRes.push({ id: String(v.id).toUpperCase(), failed: Boolean(v.failed), note: String(v.note || "") });
      } catch {
        // ignore a malformed annotation
      }
    }
    if (stepRes.length) {
      // One ID may be checked twice (e.g. desktop + phone); put() keeps the worst outcome.
      for (const s of stepRes) {
        let status;
        if (s.failed) status = "failed";
        else if (st === "passed") status = "passed";
        else if (st === "skipped") status = "skipped";
        else if (st === "flaky") status = "failed";
        else status = "blocked";
        const note = s.failed ? s.note || "UX/health issues at this step" : status === "blocked" ? `test failed elsewhere: ${err}` : st === "flaky" ? "flaky: passed only on retry" : "";
        put(s.id, status, note, title);
      }
      continue;
    }
    const ids = [...new Set([...ann.filter((a) => a.type === "usecase").map((a) => String(a.description || "").toUpperCase()), ...idsInText(t.title)])].filter(Boolean);
    for (const id of ids) {
      if (st === "flaky") put(id, "failed", `flaky: passed only on retry${err ? ` — ${err}` : ""}`, title);
      else put(id, st, st === "failed" ? err : "", title);
    }
  }
  return [...by.values()].sort((a, b) => a.useCaseId.localeCompare(b.useCaseId));
}

/** Flatten a Playwright JSON-reporter report into resultsFromTests() input. */
function testsFromPlaywrightJson(report) {
  const out = [];
  const walk = (suite, file) => {
    const f = suite.file || file || "";
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const results = Array.isArray(t.results) ? t.results : [];
        const last = results[results.length - 1] || {};
        const annotations = [...(t.annotations || []), ...results.flatMap((r) => r.annotations || [])];
        const error =
          (last.error && (last.error.message || last.error.value)) ||
          ((last.errors || [])[0] && ((last.errors[0].message) || last.errors[0].value)) ||
          "";
        out.push({ title: spec.title, file: spec.file || f, project: t.projectName || "", status: t.status || last.status, error: String(error).replace(/\u001b\[[0-9;]*m/g, ""), annotations });
      }
    }
    for (const s of suite.suites || []) walk(s, f);
  };
  for (const s of (report && report.suites) || []) walk(s, "");
  return out;
}

module.exports = { idsInText, testStatus, resultsFromTests, testsFromPlaywrightJson };
