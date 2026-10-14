const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Returns",
  "path": "/fulfill/orders/return",
  "stepPrefix": "FULFILLMENT-RETURN"
};

test("Fulfillment: Returns UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-RETURN-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-RETURN-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-RETURN-03", "Open Fulfillment \u2014 Returns", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-RETURN-04", "Confirm Returns stayed on /fulfill/orders/return", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-RETURN-05", "Run all UI audit rules on Fulfillment Returns", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
