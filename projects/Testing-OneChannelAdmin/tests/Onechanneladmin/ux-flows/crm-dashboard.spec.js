const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Dashboard",
  "path": "/crm/dashboard",
  "stepPrefix": "CRM-DASHBOARD"
};

test("CRM: Dashboard UI UX audit", async ({ page }) => {
  await soft("CRM-DASHBOARD-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-DASHBOARD-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-DASHBOARD-03", "Open CRM \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-DASHBOARD-04", "Confirm Dashboard stayed on /crm/dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-DASHBOARD-05", "Run all UI audit rules on CRM Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
