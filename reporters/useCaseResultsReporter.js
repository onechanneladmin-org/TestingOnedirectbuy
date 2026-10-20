/**
 * Playwright reporter: one result per use-case ID for the coverage dashboard (/coverage).
 *
 * Works for plain test()/expect() specs (e.g. Coupons.spec.js, the flows/ specs), which do not
 * post step updates the way softCheck() does. IDs come from `usecase` / `usecase-result`
 * annotations or the test title (lib/useCaseReport.js).
 *
 * Always writes test-results/usecase-results.json. Uploads when USECASE_RESULTS_UPLOAD=1:
 *   USECASE_RESULTS_URL   default STATUS_API_URL or http://127.0.0.1:3847
 *   USECASE_RESULTS_TOKEN default API_TOKEN (sent as Bearer)
 * A failed upload is logged, never fails the run.
 */
const fs = require("fs");
const path = require("path");
const { resultsFromTests } = require("../lib/useCaseReport");

const OUT_FILE = path.join("test-results", "usecase-results.json");

class UseCaseResultsReporter {
  constructor() {
    /** @type {Map<string, {test: any, last: any}>} */
    this.byTest = new Map();
    this.startedAt = new Date();
  }

  onTestEnd(test, result) {
    // Called once per attempt; keep the latest, the final outcome is read in onEnd.
    this.byTest.set(test.id, { test, last: result });
  }

  async onEnd() {
    const tests = [...this.byTest.values()].map(({ test, last }) => {
      let project = "";
      try {
        project = test.parent && test.parent.project && test.parent.project() ? test.parent.project().name : "";
      } catch {
        project = "";
      }
      return {
        title: test.title,
        file: test.location ? path.relative(process.cwd(), test.location.file) : "",
        project,
        status: typeof test.outcome === "function" ? test.outcome() : last.status,
        error: last.error ? String(last.error.message || last.error.value || "").replace(/\u001b\[[0-9;]*m/g, "") : "",
        annotations: [...(test.annotations || []), ...((last && last.annotations) || [])],
      };
    });
    const results = resultsFromTests(tests);
    const runId = `pw-${this.startedAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
    try {
      fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
      fs.writeFileSync(OUT_FILE, JSON.stringify({ runId, at: new Date().toISOString(), results }, null, 2));
    } catch (err) {
      console.warn(`[usecase-results] could not write ${OUT_FILE}: ${err.message}`);
    }
    console.log(`[usecase-results] ${results.length} use case(s) → ${OUT_FILE}`);

    if (process.env.USECASE_RESULTS_UPLOAD !== "1" || !results.length) return;
    const base = String(process.env.USECASE_RESULTS_URL || process.env.STATUS_API_URL || "http://127.0.0.1:3847").replace(/\/+$/, "");
    const token = process.env.USECASE_RESULTS_TOKEN || process.env.API_TOKEN || "";
    try {
      const res = await fetch(`${base}/api/usecases/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ source: "playwright-reporter", runId, results }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
      console.log(`[usecase-results] uploaded to ${base}: ${text.slice(0, 120)}`);
    } catch (err) {
      console.warn(`[usecase-results] upload failed (results kept in ${OUT_FILE}): ${err.message}`);
    }
  }
}

module.exports = UseCaseResultsReporter;
