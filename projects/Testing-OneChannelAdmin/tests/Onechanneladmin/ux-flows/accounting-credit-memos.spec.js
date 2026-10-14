const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Credit Memos",
  "path": "/accounting/credit-memos",
  "stepPrefix": "ACCOUNTING-CREDIT-"
};

test("Accounting: Credit Memos UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-CREDIT--01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-CREDIT--02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-CREDIT--03", "Open Accounting \u2014 Credit Memos", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-CREDIT--04", "Confirm Credit Memos stayed on /accounting/credit-memos", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-CREDIT--05", "Run all UI audit rules on Accounting Credit Memos", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
