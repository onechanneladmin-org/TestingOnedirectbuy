const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "1CA CRMhub",
  "path": "/marketing/engage",
  "stepPrefix": "CRM-1CA-CRMHUB"
};

test("CRM: 1CA CRMhub UI UX audit", async ({ page }) => {
  await soft("CRM-1CA-CRMHUB-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-1CA-CRMHUB-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-1CA-CRMHUB-03", "Open CRM \u2014 1CA CRMhub", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-1CA-CRMHUB-04", "Confirm 1CA CRMhub stayed on /marketing/engage", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-1CA-CRMHUB-05", "Run all UI audit rules on CRM 1CA CRMhub", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
