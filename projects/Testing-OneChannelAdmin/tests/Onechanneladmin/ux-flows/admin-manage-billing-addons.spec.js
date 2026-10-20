const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Admin",
  "name": "Manage Billing & AddOns",
  "path": "/settings/managebillings-addons",
  "stepPrefix": "ADMIN-MANAGE-BILLI"
};

test("Admin: Manage Billing & AddOns UI UX audit", async ({ page }) => {
  await soft("ADMIN-MANAGE-BILLI-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ADMIN-MANAGE-BILLI-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ADMIN-MANAGE-BILLI-03", "Open Admin \u2014 Manage Billing & AddOns", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-MANAGE-BILLI-04", "Confirm Manage Billing & AddOns stayed on /settings/managebillings-addons", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ADMIN-MANAGE-BILLI-05", "Run all UI audit rules on Admin Manage Billing & AddOns", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
