const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Expenses",
  "path": "/accounting/expenses",
  "stepPrefix": "ACCOUNTING-EXPENSE"
};

test("Accounting: Expenses UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-EXPENSE-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-EXPENSE-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-EXPENSE-03", "Open Accounting \u2014 Expenses", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-EXPENSE-04", "Confirm Expenses stayed on /accounting/expenses", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-EXPENSE-05", "Run all UI audit rules on Accounting Expenses", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
