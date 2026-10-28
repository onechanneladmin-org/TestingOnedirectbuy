const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage } = require("./uxAuditSteps");
const { auditComponents, CHROME_SELECTOR } = require("../../../lib/ui-audit/components");

// The left nav, top bar (org switcher, bell …) and AI chat drawer are on every page; the page audits
// skip them (components.js CHROME_SELECTOR) and this spec audits them once.
const entry = {
  "hub": "Global",
  "name": "App Chrome",
  "path": "/home/dashboard",
  "stepPrefix": "GLOBAL-CHROME"
};

test("Global: App chrome (nav, top bar, chat) UI UX audit", async ({ page }) => {
  await soft("GLOBAL-CHROME-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("GLOBAL-CHROME-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("GLOBAL-CHROME-03", "Open Home — Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("GLOBAL-CHROME-04", "Audit the components of the nav, top bar and chat drawer", async () => {
    const reportDir = path.join(process.cwd(), "ux-audit-report", "global-app-chrome");
    const { findings, coverage } = await auditComponents(page, {
      reportDir,
      rootSelector: CHROME_SELECTOR,
      reload: () => page.reload({ waitUntil: "domcontentloaded" }),
    });
    fs.writeFileSync(path.join(reportDir, "component-coverage.json"), JSON.stringify(coverage, null, 2));
    fs.writeFileSync(path.join(reportDir, "findings.json"), JSON.stringify(findings, null, 2));
    const found = Object.entries(coverage).filter(([, c]) => c.found).map(([k, c]) => `${k} ${c.found}/${c.probed}${c.failed ? `!${c.failed}` : ""}`);
    console.log(`[ux-audit] components in app chrome: ${found.join(", ") || "(none)"} (found/probed!failed)`);
    for (const f of findings) await reportFlowIssue(f);
    expect(findings.map((f) => `${f.ruleId}: ${f.message}`), "app chrome component findings").toEqual([]);
  });
});
