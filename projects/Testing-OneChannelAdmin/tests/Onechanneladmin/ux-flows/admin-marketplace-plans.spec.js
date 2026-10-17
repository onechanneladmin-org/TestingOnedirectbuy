const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Admin",
  "name": "Marketplace Plans",
  "path": "/settings/marketplace-plans",
  "stepPrefix": "ADMIN-MARKETPLACE-"
};

test("Admin: Marketplace Plans UI UX audit", async ({ page }) => {
  await soft("ADMIN-MARKETPLACE--01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ADMIN-MARKETPLACE--02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ADMIN-MARKETPLACE--03", "Open Admin \u2014 Marketplace Plans", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-MARKETPLACE--04", "Confirm Marketplace Plans stayed on /settings/marketplace-plans", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ADMIN-MARKETPLACE--05", "Run all UI audit rules on Admin Marketplace Plans", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
