const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Order Replenishment",
  "path": "/wms/order_replenishment?isWms=true",
  "stepPrefix": "WMS-ORDER-REPLENIS"
};

test("WMS: Order Replenishment UI UX audit", async ({ page }) => {
  await soft("WMS-ORDER-REPLENIS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-ORDER-REPLENIS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-ORDER-REPLENIS-03", "Open WMS \u2014 Order Replenishment", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-ORDER-REPLENIS-04", "Confirm Order Replenishment stayed on /wms/order_replenishment?isWms=true", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("WMS-ORDER-REPLENIS-05", "Run all UI audit rules on WMS Order Replenishment", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
