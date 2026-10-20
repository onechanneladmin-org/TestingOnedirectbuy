const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Services Offered",
  "path": "/crm/workservices",
  "stepPrefix": "CRM-SERVICES-OFFER"
};

test("CRM: Services Offered UI UX audit", async ({ page }) => {
  await soft("CRM-SERVICES-OFFER-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-SERVICES-OFFER-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-SERVICES-OFFER-03", "Open CRM \u2014 Services Offered", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-SERVICES-OFFER-04", "Confirm Services Offered stayed on /crm/workservices", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CRM-SERVICES-OFFER-05", "Run all UI audit rules on CRM Services Offered", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
