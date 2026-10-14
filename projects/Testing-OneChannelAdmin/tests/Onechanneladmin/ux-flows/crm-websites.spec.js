const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Websites",
  "path": "/b2b/b2bwebsites",
  "stepPrefix": "CRM-WEBSITES"
};

test("CRM: Websites UI UX audit", async ({ page }) => {
  await soft("CRM-WEBSITES-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-WEBSITES-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-WEBSITES-03", "Open CRM \u2014 Websites", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-WEBSITES-04", "Confirm Websites stayed on /b2b/b2bwebsites", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-WEBSITES-05", "Run all UI audit rules on CRM Websites", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
