const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Invoices",
  "path": "/accounting/invoices",
  "stepPrefix": "ACCOUNTING-INVOICE"
};

test("Accounting: Invoices UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-INVOICE-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-INVOICE-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-INVOICE-03", "Open Accounting \u2014 Invoices", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-INVOICE-04", "Confirm Invoices stayed on /accounting/invoices", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-INVOICE-05", "Run all UI audit rules on Accounting Invoices", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
