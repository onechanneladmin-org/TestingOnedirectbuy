const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Transfers",
  "path": "/wms/transfers",
  "stepPrefix": "WMS-TRANSFERS"
};

test("WMS: Transfers UI UX audit", async ({ page }) => {
  await soft("WMS-TRANSFERS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-TRANSFERS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-TRANSFERS-03", "Open WMS \u2014 Transfers", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-TRANSFERS-04", "Confirm Transfers stayed on /wms/transfers", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-TRANSFERS-05", "Run all UI audit rules on WMS Transfers", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
