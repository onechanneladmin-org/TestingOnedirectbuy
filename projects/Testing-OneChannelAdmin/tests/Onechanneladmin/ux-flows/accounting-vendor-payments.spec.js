const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Vendor Payments",
  "path": "/accounting/vendor-payments",
  "stepPrefix": "ACCOUNTING-VENDOR-"
};

test("Accounting: Vendor Payments UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-VENDOR--01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-VENDOR--02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-VENDOR--03", "Open Accounting \u2014 Vendor Payments", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-VENDOR--04", "Confirm Vendor Payments stayed on /accounting/vendor-payments", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ACCOUNTING-VENDOR--05", "Run all UI audit rules on Accounting Vendor Payments", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
