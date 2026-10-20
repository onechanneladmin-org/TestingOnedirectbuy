const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "3PL",
  "name": "Dashboard",
  "path": "/3pl/dashboard",
  "stepPrefix": "3PL-DASHBOARD"
};

test("3PL: Dashboard UI UX audit", async ({ page }) => {
  await soft("3PL-DASHBOARD-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("3PL-DASHBOARD-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("3PL-DASHBOARD-03", "Open 3PL \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("3PL-DASHBOARD-04", "Confirm Dashboard stayed on /3pl/dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("3PL-DASHBOARD-05", "Run all UI audit rules on 3PL Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
