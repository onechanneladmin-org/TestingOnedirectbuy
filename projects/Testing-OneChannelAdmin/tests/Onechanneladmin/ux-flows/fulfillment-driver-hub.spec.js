const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Driver Hub",
  "path": "/delivery/hub",
  "stepPrefix": "FULFILLMENT-DRIVER"
};

test("Fulfillment: Driver Hub UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-DRIVER-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-DRIVER-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-DRIVER-03", "Open Fulfillment \u2014 Driver Hub", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-DRIVER-04", "Confirm Driver Hub stayed on /delivery/hub", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("FULFILLMENT-DRIVER-05", "Run all UI audit rules on Fulfillment Driver Hub", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
