const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Dashboard",
  "path": "/fulfill/orders/dashboard",
  "stepPrefix": "FULFILLMENT-DASHBO"
};

test("Fulfillment: Dashboard UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-DASHBO-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-DASHBO-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-DASHBO-03", "Open Fulfillment \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-DASHBO-04", "Confirm Dashboard stayed on /fulfill/orders/dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-DASHBO-05", "Run all UI audit rules on Fulfillment Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
