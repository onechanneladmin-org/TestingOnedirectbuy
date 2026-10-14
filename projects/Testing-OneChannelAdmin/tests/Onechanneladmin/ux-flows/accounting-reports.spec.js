const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Reports",
  "path": "/accounting/reports",
  "stepPrefix": "ACCOUNTING-REPORTS"
};

test("Accounting: Reports UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-REPORTS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-REPORTS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-REPORTS-03", "Open Accounting \u2014 Reports", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-REPORTS-04", "Confirm Reports stayed on /accounting/reports", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-REPORTS-05", "Run all UI audit rules on Accounting Reports", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
