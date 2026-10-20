const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Suppliers B2B",
  "path": "/crm/contacts-customers",
  "stepPrefix": "CRM-SUPPLIERS-B2B"
};

test("CRM: Suppliers B2B UI UX audit", async ({ page }) => {
  await soft("CRM-SUPPLIERS-B2B-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-SUPPLIERS-B2B-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-SUPPLIERS-B2B-03", "Open CRM \u2014 Suppliers B2B", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-SUPPLIERS-B2B-04", "Confirm Suppliers B2B stayed on /crm/contacts-customers", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CRM-SUPPLIERS-B2B-05", "Run all UI audit rules on CRM Suppliers B2B", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
