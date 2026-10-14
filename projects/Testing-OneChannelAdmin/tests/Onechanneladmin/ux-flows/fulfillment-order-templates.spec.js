const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Order Templates",
  "path": "/fulfill/orders/templates",
  "stepPrefix": "FULFILLMENT-ORDER-"
};

test("Fulfillment: Order Templates UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-ORDER--01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-ORDER--02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-ORDER--03", "Open Fulfillment \u2014 Order Templates", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-ORDER--04", "Confirm Order Templates stayed on /fulfill/orders/templates", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-ORDER--05", "Run all UI audit rules on Fulfillment Order Templates", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
