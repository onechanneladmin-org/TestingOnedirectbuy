const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "General Ledger",
  "path": "/accounting/general-ledger",
  "stepPrefix": "ACCOUNTING-GENERAL"
};

test("Accounting: General Ledger UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-GENERAL-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-GENERAL-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-GENERAL-03", "Open Accounting \u2014 General Ledger", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-GENERAL-04", "Confirm General Ledger stayed on /accounting/general-ledger", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-GENERAL-05", "Run all UI audit rules on Accounting General Ledger", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
