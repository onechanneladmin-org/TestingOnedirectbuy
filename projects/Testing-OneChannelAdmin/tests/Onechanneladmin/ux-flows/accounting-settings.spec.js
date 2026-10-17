const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Settings",
  "path": "/accounting/accounting-settings",
  "stepPrefix": "ACCOUNTING-SETTING"
};

test("Accounting: Settings UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-SETTING-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-SETTING-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-SETTING-03", "Open Accounting \u2014 Settings", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-SETTING-04", "Confirm Settings stayed on /accounting/accounting-settings", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ACCOUNTING-SETTING-05", "Run all UI audit rules on Accounting Settings", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
