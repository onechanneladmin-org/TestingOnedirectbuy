const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Account Statements",
  "path": "/accounting/account-statements",
  "stepPrefix": "ACCOUNTING-ACCOUNT"
};

test("Accounting: Account Statements UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-ACCOUNT-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-ACCOUNT-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-ACCOUNT-03", "Open Accounting \u2014 Account Statements", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-ACCOUNT-04", "Confirm Account Statements stayed on /accounting/account-statements", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-ACCOUNT-05", "Run all UI audit rules on Accounting Account Statements", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
