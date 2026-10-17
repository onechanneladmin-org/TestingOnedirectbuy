const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Admin",
  "name": "Addons & Invoices",
  "path": "/settings/billing-invoices",
  "stepPrefix": "ADMIN-ADDONS-INVOI"
};

test("Admin: Addons & Invoices UI UX audit", async ({ page }) => {
  await soft("ADMIN-ADDONS-INVOI-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ADMIN-ADDONS-INVOI-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ADMIN-ADDONS-INVOI-03", "Open Admin \u2014 Addons & Invoices", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-ADDONS-INVOI-04", "Confirm Addons & Invoices stayed on /settings/billing-invoices", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ADMIN-ADDONS-INVOI-05", "Run all UI audit rules on Admin Addons & Invoices", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
