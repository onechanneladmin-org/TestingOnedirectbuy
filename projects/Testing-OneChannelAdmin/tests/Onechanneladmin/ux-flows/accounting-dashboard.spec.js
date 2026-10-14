const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Dashboard",
  "path": "/accounting/dashboard",
  "stepPrefix": "ACCOUNTING-DASHBOA"
};

test("Accounting: Dashboard UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-DASHBOA-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-DASHBOA-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-DASHBOA-03", "Open Accounting \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-DASHBOA-04", "Confirm Dashboard stayed on /accounting/dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-DASHBOA-05", "Run all UI audit rules on Accounting Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
