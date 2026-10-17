const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Refunds",
  "path": "/fulfill/orders/refund",
  "stepPrefix": "FULFILLMENT-REFUND"
};

test("Fulfillment: Refunds UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-REFUND-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-REFUND-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-REFUND-03", "Open Fulfillment \u2014 Refunds", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-REFUND-04", "Confirm Refunds stayed on /fulfill/orders/refund", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("FULFILLMENT-REFUND-05", "Run all UI audit rules on Fulfillment Refunds", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
