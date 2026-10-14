const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Default Shipping Address",
  "path": "/settings/general",
  "stepPrefix": "FULFILLMENT-DEFAUL"
};

test("Fulfillment: Default Shipping Address UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-DEFAUL-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-DEFAUL-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-DEFAUL-03", "Open Fulfillment \u2014 Default Shipping Address", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-DEFAUL-04", "Confirm Default Shipping Address stayed on /settings/general", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-DEFAUL-05", "Run all UI audit rules on Fulfillment Default Shipping Address", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
