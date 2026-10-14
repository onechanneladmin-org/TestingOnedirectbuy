const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Chart of Accounts",
  "path": "/accounting/chart-of-accounts",
  "stepPrefix": "ACCOUNTING-CHART-O"
};

test("Accounting: Chart of Accounts UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-CHART-O-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-CHART-O-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-CHART-O-03", "Open Accounting \u2014 Chart of Accounts", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-CHART-O-04", "Confirm Chart of Accounts stayed on /accounting/chart-of-accounts", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-CHART-O-05", "Run all UI audit rules on Accounting Chart of Accounts", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
