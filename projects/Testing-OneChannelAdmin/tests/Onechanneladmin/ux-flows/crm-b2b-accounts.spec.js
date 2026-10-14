const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "B2B Accounts",
  "path": "/crm/company",
  "stepPrefix": "CRM-B2B-ACCOUNTS"
};

test("CRM: B2B Accounts UI UX audit", async ({ page }) => {
  await soft("CRM-B2B-ACCOUNTS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-B2B-ACCOUNTS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-B2B-ACCOUNTS-03", "Open CRM \u2014 B2B Accounts", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-B2B-ACCOUNTS-04", "Confirm B2B Accounts stayed on /crm/company", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-B2B-ACCOUNTS-05", "Run all UI audit rules on CRM B2B Accounts", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
