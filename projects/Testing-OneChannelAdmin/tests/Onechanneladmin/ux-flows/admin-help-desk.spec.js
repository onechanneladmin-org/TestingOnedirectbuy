const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Admin",
  "name": "Help Desk",
  "path": "/settings/help-center",
  "stepPrefix": "ADMIN-HELP-DESK"
};

test("Admin: Help Desk UI UX audit", async ({ page }) => {
  await soft("ADMIN-HELP-DESK-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ADMIN-HELP-DESK-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ADMIN-HELP-DESK-03", "Open Admin \u2014 Help Desk", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-HELP-DESK-04", "Confirm Help Desk stayed on /settings/help-center", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ADMIN-HELP-DESK-05", "Run all UI audit rules on Admin Help Desk", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
