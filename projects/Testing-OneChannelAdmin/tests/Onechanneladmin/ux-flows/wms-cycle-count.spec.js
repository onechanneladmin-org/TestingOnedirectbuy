const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Cycle Count",
  "path": "/products/cycle-count",
  "stepPrefix": "WMS-CYCLE-COUNT"
};

test("WMS: Cycle Count UI UX audit", async ({ page }) => {
  await soft("WMS-CYCLE-COUNT-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-CYCLE-COUNT-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-CYCLE-COUNT-03", "Open WMS \u2014 Cycle Count", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-CYCLE-COUNT-04", "Confirm Cycle Count stayed on /products/cycle-count", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("WMS-CYCLE-COUNT-05", "Run all UI audit rules on WMS Cycle Count", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
