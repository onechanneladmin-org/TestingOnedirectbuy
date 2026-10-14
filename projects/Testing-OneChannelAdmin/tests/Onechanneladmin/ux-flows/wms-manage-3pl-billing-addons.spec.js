const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Manage 3pl Billing/Addons",
  "path": "/wms/manage3pladdons",
  "stepPrefix": "WMS-MANAGE-3PL-BIL"
};

test("WMS: Manage 3pl Billing/Addons UI UX audit", async ({ page }) => {
  await soft("WMS-MANAGE-3PL-BIL-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-MANAGE-3PL-BIL-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-MANAGE-3PL-BIL-03", "Open WMS \u2014 Manage 3pl Billing/Addons", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-MANAGE-3PL-BIL-04", "Confirm Manage 3pl Billing/Addons stayed on /wms/manage3pladdons", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-MANAGE-3PL-BIL-05", "Run all UI audit rules on WMS Manage 3pl Billing/Addons", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
