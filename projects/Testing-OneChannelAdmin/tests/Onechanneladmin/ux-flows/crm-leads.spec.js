const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Leads",
  "path": "/crm/leads",
  "stepPrefix": "CRM-LEADS"
};

test("CRM: Leads UI UX audit", async ({ page }) => {
  await soft("CRM-LEADS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-LEADS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-LEADS-03", "Open CRM \u2014 Leads", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-LEADS-04", "Confirm Leads stayed on /crm/leads", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-LEADS-05", "Run all UI audit rules on CRM Leads", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
