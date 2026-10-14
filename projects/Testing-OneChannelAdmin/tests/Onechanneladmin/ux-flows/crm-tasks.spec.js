const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Tasks",
  "path": "/crm/tasks",
  "stepPrefix": "CRM-TASKS"
};

test("CRM: Tasks UI UX audit", async ({ page }) => {
  await soft("CRM-TASKS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-TASKS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-TASKS-03", "Open CRM \u2014 Tasks", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-TASKS-04", "Confirm Tasks stayed on /crm/tasks", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-TASKS-05", "Run all UI audit rules on CRM Tasks", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
