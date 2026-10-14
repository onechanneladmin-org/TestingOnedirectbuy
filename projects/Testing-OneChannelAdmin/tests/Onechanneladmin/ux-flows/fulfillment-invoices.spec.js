const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

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

  await soft("FULFILLMENT-INVOIC-05", "Run all UI audit rules on Fulfillment Invoices", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
