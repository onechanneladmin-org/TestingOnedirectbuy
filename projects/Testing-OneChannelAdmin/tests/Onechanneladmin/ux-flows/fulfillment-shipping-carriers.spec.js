const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Shipping Carriers",
  "path": "/fulfill/settings/carriers",
  "stepPrefix": "FULFILLMENT-SHIPPI"
};

test("Fulfillment: Shipping Carriers UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-SHIPPI-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-SHIPPI-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-SHIPPI-03", "Open Fulfillment \u2014 Shipping Carriers", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-SHIPPI-04", "Confirm Shipping Carriers stayed on /fulfill/settings/carriers", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("FULFILLMENT-SHIPPI-05", "Run all UI audit rules on Fulfillment Shipping Carriers", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
