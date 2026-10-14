const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Claims",
  "path": "/fulfill/orders/claims",
  "stepPrefix": "FULFILLMENT-CLAIMS"
};

test("Fulfillment: Claims UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-CLAIMS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-CLAIMS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-CLAIMS-03", "Open Fulfillment \u2014 Claims", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-CLAIMS-04", "Confirm Claims stayed on /fulfill/orders/claims", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-CLAIMS-05", "Run all UI audit rules on Fulfillment Claims", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
