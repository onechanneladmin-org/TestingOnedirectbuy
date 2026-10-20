const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Invoices",
  "path": "/settings/accounting-invoices",
  "stepPrefix": "FULFILLMENT-INVOIC"
};

test("Fulfillment: Invoices UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-INVOIC-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-INVOIC-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-INVOIC-03", "Open Fulfillment \u2014 Invoices", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-INVOIC-04", "Confirm Invoices stayed on /settings/accounting-invoices", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("FULFILLMENT-INVOIC-05", "Run all UI audit rules on Fulfillment Invoices", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
