const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Archived Orders",
  "path": "/fulfill/orders/archived",
  "stepPrefix": "FULFILLMENT-ARCHIV"
};

test("Fulfillment: Archived Orders UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-ARCHIV-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-ARCHIV-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-ARCHIV-03", "Open Fulfillment \u2014 Archived Orders", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-ARCHIV-04", "Confirm Archived Orders stayed on /fulfill/orders/archived", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-ARCHIV-05", "Run all UI audit rules on Fulfillment Archived Orders", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
