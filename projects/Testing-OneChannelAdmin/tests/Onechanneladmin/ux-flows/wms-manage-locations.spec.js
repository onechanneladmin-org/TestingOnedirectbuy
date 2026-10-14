const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Manage Locations",
  "path": "/wms/setup",
  "stepPrefix": "WMS-MANAGE-LOCATIO"
};

test("WMS: Manage Locations UI UX audit", async ({ page }) => {
  await soft("WMS-MANAGE-LOCATIO-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-MANAGE-LOCATIO-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-MANAGE-LOCATIO-03", "Open WMS \u2014 Manage Locations", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-MANAGE-LOCATIO-04", "Confirm Manage Locations stayed on /wms/setup", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-MANAGE-LOCATIO-05", "Run all UI audit rules on WMS Manage Locations", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
