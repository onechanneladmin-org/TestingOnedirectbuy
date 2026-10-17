const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Period Close",
  "path": "/accounting/period-close",
  "stepPrefix": "ACCOUNTING-PERIOD-"
};

test("Accounting: Period Close UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-PERIOD--01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-PERIOD--02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-PERIOD--03", "Open Accounting \u2014 Period Close", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-PERIOD--04", "Confirm Period Close stayed on /accounting/period-close", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ACCOUNTING-PERIOD--05", "Run all UI audit rules on Accounting Period Close", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
