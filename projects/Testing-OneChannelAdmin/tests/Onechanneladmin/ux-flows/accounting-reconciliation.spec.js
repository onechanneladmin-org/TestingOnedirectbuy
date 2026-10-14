const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Reconciliation",
  "path": "/accounting/reconciliation",
  "stepPrefix": "ACCOUNTING-RECONCI"
};

test("Accounting: Reconciliation UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-RECONCI-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-RECONCI-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-RECONCI-03", "Open Accounting \u2014 Reconciliation", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-RECONCI-04", "Confirm Reconciliation stayed on /accounting/reconciliation", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-RECONCI-05", "Run all UI audit rules on Accounting Reconciliation", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
