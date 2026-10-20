const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Transactions",
  "path": "/accounting/transactions",
  "stepPrefix": "ACCOUNTING-TRANSAC"
};

test("Accounting: Transactions UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-TRANSAC-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-TRANSAC-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-TRANSAC-03", "Open Accounting \u2014 Transactions", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-TRANSAC-04", "Confirm Transactions stayed on /accounting/transactions", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ACCOUNTING-TRANSAC-05", "Run all UI audit rules on Accounting Transactions", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
