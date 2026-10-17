const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Orders",
  "path": "/wms/orders?warehouse=wh1",
  "stepPrefix": "WMS-ORDERS"
};

test("WMS: Orders UI UX audit", async ({ page }) => {
  await soft("WMS-ORDERS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-ORDERS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-ORDERS-03", "Open WMS \u2014 Orders", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-ORDERS-04", "Confirm Orders stayed on /wms/orders?warehouse=wh1", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("WMS-ORDERS-05", "Run all UI audit rules on WMS Orders", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
