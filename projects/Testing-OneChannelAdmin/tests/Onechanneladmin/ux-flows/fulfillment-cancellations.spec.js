const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Cancellations",
  "path": "/fulfill/orders/cancel",
  "stepPrefix": "FULFILLMENT-CANCEL"
};

test("Fulfillment: Cancellations UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-CANCEL-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-CANCEL-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-CANCEL-03", "Open Fulfillment \u2014 Cancellations", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-CANCEL-04", "Confirm Cancellations stayed on /fulfill/orders/cancel", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("FULFILLMENT-CANCEL-05", "Run all UI audit rules on Fulfillment Cancellations", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
