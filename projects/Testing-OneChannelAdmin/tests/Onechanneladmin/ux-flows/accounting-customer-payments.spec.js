const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Customer Payments",
  "path": "/accounting/customer-payments",
  "stepPrefix": "ACCOUNTING-CUSTOME"
};

test("Accounting: Customer Payments UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-CUSTOME-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-CUSTOME-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-CUSTOME-03", "Open Accounting \u2014 Customer Payments", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-CUSTOME-04", "Confirm Customer Payments stayed on /accounting/customer-payments", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ACCOUNTING-CUSTOME-05", "Run all UI audit rules on Accounting Customer Payments", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
