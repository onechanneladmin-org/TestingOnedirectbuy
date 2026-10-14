const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Deliveries/Pickups",
  "path": "/fulfill/orders/deliveries",
  "stepPrefix": "FULFILLMENT-DELIVE"
};

test("Fulfillment: Deliveries/Pickups UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-DELIVE-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-DELIVE-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-DELIVE-03", "Open Fulfillment \u2014 Deliveries/Pickups", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-DELIVE-04", "Confirm Deliveries/Pickups stayed on /fulfill/orders/deliveries", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-DELIVE-05", "Run all UI audit rules on Fulfillment Deliveries/Pickups", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
