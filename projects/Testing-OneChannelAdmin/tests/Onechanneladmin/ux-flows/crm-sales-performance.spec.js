const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Sales Performance",
  "path": "/crm/sales-performance",
  "stepPrefix": "CRM-SALES-PERFORMA"
};

test("CRM: Sales Performance UI UX audit", async ({ page }) => {
  await soft("CRM-SALES-PERFORMA-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-SALES-PERFORMA-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-SALES-PERFORMA-03", "Open CRM \u2014 Sales Performance", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-SALES-PERFORMA-04", "Confirm Sales Performance stayed on /crm/sales-performance", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CRM-SALES-PERFORMA-05", "Run all UI audit rules on CRM Sales Performance", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
