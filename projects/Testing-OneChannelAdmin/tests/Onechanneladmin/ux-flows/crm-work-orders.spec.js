const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Work Orders",
  "path": "/crm/workorders",
  "stepPrefix": "CRM-WORK-ORDERS"
};

test("CRM: Work Orders UI UX audit", async ({ page }) => {
  await soft("CRM-WORK-ORDERS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-WORK-ORDERS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-WORK-ORDERS-03", "Open CRM \u2014 Work Orders", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-WORK-ORDERS-04", "Confirm Work Orders stayed on /crm/workorders", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CRM-WORK-ORDERS-05", "Run all UI audit rules on CRM Work Orders", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
