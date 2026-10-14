const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Dashboard",
  "path": "/wms/dashboard?warehouse=wh1",
  "stepPrefix": "WMS-DASHBOARD"
};

test("WMS: Dashboard UI UX audit", async ({ page }) => {
  await soft("WMS-DASHBOARD-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-DASHBOARD-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-DASHBOARD-03", "Open WMS \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-DASHBOARD-04", "Confirm Dashboard stayed on /wms/dashboard?warehouse=wh1", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-DASHBOARD-05", "Run all UI audit rules on WMS Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
