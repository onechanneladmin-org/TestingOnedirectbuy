const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Shipments",
  "path": "/fulfill/orders/shipment",
  "stepPrefix": "FULFILLMENT-SHIPME"
};

test("Fulfillment: Shipments UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-SHIPME-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-SHIPME-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-SHIPME-03", "Open Fulfillment \u2014 Shipments", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-SHIPME-04", "Confirm Shipments stayed on /fulfill/orders/shipment", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-SHIPME-05", "Run all UI audit rules on Fulfillment Shipments", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
