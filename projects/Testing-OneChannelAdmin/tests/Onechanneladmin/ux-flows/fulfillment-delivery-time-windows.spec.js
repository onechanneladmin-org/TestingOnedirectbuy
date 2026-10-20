const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Delivery Time Windows",
  "path": "/fulfill/settings/delivery-time-windows",
  "stepPrefix": "FULFILLMENT-DELIVE"
};

test("Fulfillment: Delivery Time Windows UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-DELIVE-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-DELIVE-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-DELIVE-03", "Open Fulfillment \u2014 Delivery Time Windows", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-DELIVE-04", "Confirm Delivery Time Windows stayed on /fulfill/settings/delivery-time-windows", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("FULFILLMENT-DELIVE-05", "Run all UI audit rules on Fulfillment Delivery Time Windows", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
