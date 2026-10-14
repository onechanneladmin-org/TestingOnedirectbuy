const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Rental Orders",
  "path": "/fulfill/orders/rentals",
  "stepPrefix": "FULFILLMENT-RENTAL"
};

test("Fulfillment: Rental Orders UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-RENTAL-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-RENTAL-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-RENTAL-03", "Open Fulfillment \u2014 Rental Orders", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-RENTAL-04", "Confirm Rental Orders stayed on /fulfill/orders/rentals", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-RENTAL-05", "Run all UI audit rules on Fulfillment Rental Orders", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
