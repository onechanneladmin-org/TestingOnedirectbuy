const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "B2B",
  "name": "Dashboard",
  "path": "/b2b/dashboard",
  "stepPrefix": "B2B-DASHBOARD"
};

test("B2B: Dashboard UI UX audit", async ({ page }) => {
  await soft("B2B-DASHBOARD-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("B2B-DASHBOARD-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("B2B-DASHBOARD-03", "Open B2B \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("B2B-DASHBOARD-04", "Confirm Dashboard stayed on /b2b/dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("B2B-DASHBOARD-05", "Run all UI audit rules on B2B Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
