const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Multi Entity",
  "path": "/accounting/multi-entity",
  "stepPrefix": "ACCOUNTING-MULTI-E"
};

test("Accounting: Multi Entity UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-MULTI-E-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-MULTI-E-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-MULTI-E-03", "Open Accounting \u2014 Multi Entity", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-MULTI-E-04", "Confirm Multi Entity stayed on /accounting/multi-entity", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ACCOUNTING-MULTI-E-05", "Run all UI audit rules on Accounting Multi Entity", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
