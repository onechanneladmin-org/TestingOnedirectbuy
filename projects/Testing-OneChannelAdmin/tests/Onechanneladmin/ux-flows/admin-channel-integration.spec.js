const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Admin",
  "name": "Channel Integration",
  "path": "/settings/channel-settings",
  "stepPrefix": "ADMIN-CHANNEL-INTE"
};

test("Admin: Channel Integration UI UX audit", async ({ page }) => {
  await soft("ADMIN-CHANNEL-INTE-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ADMIN-CHANNEL-INTE-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ADMIN-CHANNEL-INTE-03", "Open Admin \u2014 Channel Integration", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-CHANNEL-INTE-04", "Confirm Channel Integration stayed on /settings/channel-settings", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ADMIN-CHANNEL-INTE-05", "Run all UI audit rules on Admin Channel Integration", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
