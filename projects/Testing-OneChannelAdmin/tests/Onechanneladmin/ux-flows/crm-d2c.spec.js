const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "D2C",
  "path": "/crm/ContactManage",
  "stepPrefix": "CRM-D2C"
};

test("CRM: D2C UI UX audit", async ({ page }) => {
  await soft("CRM-D2C-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-D2C-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-D2C-03", "Open CRM \u2014 D2C", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-D2C-04", "Confirm D2C stayed on /crm/ContactManage", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-D2C-05", "Run all UI audit rules on CRM D2C", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
