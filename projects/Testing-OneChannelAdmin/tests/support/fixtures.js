// Shared Playwright fixtures for the 1CA flow specs (ported from onechanneladmin-latest apps/web/e2e):
//   settings  — e2eSettings() (env-only credentials, never printed)
//   health    — console / pageerror / 5xx collector for the page (support/page-health.js)
//   netGuard  — AUTO: aborts any backend request for a denied org (Nexus) and, in E2E_READ_ONLY=1,
//               every non-GET backend request; denied-org hits fail the test.
//   writable  — { ok, reason } — flows that write must `test.skip(!writable.ok, writable.reason)`.
//   api       — read-back client for the 1CA backend, using the session's own auth (support/api.js).
const base = require("@playwright/test");
const { e2eSettings } = require("./env");
const G = require("./guard");
const { watchPage } = require("./page-health");
const { trackBackend } = require("./api");

const test = base.test.extend({
  settings: async ({}, use) => {
    await use(e2eSettings());
  },

  netGuard: [
    async ({ context, settings }, use, testInfo) => {
      const blocked = [];
      await context.route("**/*", (route) => {
        const req = route.request();
        const reason = G.requestBlockReason(
          { url: req.url(), method: req.method(), headers: req.headers() },
          { readOnly: settings.readOnly }
        );
        if (!reason) return route.fallback();
        blocked.push({ reason, method: req.method(), url: req.url().split("?")[0] });
        return route.abort("blockedbyclient");
      });
      await use(blocked);
      if (blocked.length) {
        await testInfo.attach("blocked-requests.json", {
          body: JSON.stringify(blocked, null, 2),
          contentType: "application/json",
        });
      }
      const denied = blocked.filter((b) => /denied org/.test(b.reason));
      base.expect(denied, "requests for a denied org (Nexus) were attempted").toEqual([]);
    },
    { auto: true },
  ],

  health: async ({ page }, use) => {
    await use(watchPage(page));
  },

  writable: async ({ settings }, use) => {
    await use(G.writesAllowed(settings.baseURL, process.env));
  },

  api: async ({ page }, use) => {
    await use(trackBackend(page));
  },
});

/** Assert the browser session is on the allow-listed test org (call at the start of each spec). */
async function expectTestOrg(page, settings) {
  G.assertTestOrg(settings.orgId, process.env);
  const current = await page.evaluate(() => localStorage.getItem("currentorganization"));
  base.expect(current, "session org must be E2E_ORG_ID").toBe(settings.orgId);
  G.assertTestOrg(current, process.env);
}

module.exports = { test, expect: base.expect, expectTestOrg };
