const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Intake Form Queries",
  "path": "/fulfill/orders/intake-quote",
  "stepPrefix": "FULFILLMENT-INTAKE"
};

test("Fulfillment: Intake Form Queries UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-INTAKE-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-INTAKE-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-INTAKE-03", "Open Fulfillment \u2014 Intake Form Queries", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-INTAKE-04", "Confirm Intake Form Queries stayed on /fulfill/orders/intake-quote", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-INTAKE-05", "Run all UI audit rules on Fulfillment Intake Form Queries", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
