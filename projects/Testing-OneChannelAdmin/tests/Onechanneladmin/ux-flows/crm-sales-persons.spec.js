const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Sales Persons",
  "path": "/crm/salespersons",
  "stepPrefix": "CRM-SALES-PERSONS"
};

test("CRM: Sales Persons UI UX audit", async ({ page }) => {
  await soft("CRM-SALES-PERSONS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-SALES-PERSONS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-SALES-PERSONS-03", "Open CRM \u2014 Sales Persons", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-SALES-PERSONS-04", "Confirm Sales Persons stayed on /crm/salespersons", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-SALES-PERSONS-05", "Run all UI audit rules on CRM Sales Persons", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
