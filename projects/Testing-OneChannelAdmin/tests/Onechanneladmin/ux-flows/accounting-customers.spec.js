const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Customers",
  "path": "/accounting/customers",
  "stepPrefix": "ACCOUNTING-CUSTOME"
};

test("Accounting: Customers UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-CUSTOME-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-CUSTOME-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-CUSTOME-03", "Open Accounting \u2014 Customers", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-CUSTOME-04", "Confirm Customers stayed on /accounting/customers", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-CUSTOME-05", "Run all UI audit rules on Accounting Customers", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
