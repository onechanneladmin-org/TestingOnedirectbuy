const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Analytics & Reports",
  "name": "Dashboard",
  "path": "/analytics/analytics-dashboard",
  "stepPrefix": "ANALYTICS-REPORTS-"
};

test("Analytics & Reports: Dashboard UI UX audit", async ({ page }) => {
  await soft("ANALYTICS-REPORTS--01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ANALYTICS-REPORTS--02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ANALYTICS-REPORTS--03", "Open Analytics & Reports \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ANALYTICS-REPORTS--04", "Confirm Dashboard stayed on /analytics/analytics-dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ANALYTICS-REPORTS--05", "Run all UI audit rules on Analytics & Reports Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
