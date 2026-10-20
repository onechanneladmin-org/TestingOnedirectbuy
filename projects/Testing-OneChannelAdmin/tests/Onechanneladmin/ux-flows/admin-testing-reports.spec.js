const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Admin",
  "name": "Testing Reports",
  "path": "/settings/testing-reports",
  "stepPrefix": "ADMIN-TESTING-REPO"
};

test("Admin: Testing Reports UI UX audit", async ({ page }) => {
  await soft("ADMIN-TESTING-REPO-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ADMIN-TESTING-REPO-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ADMIN-TESTING-REPO-03", "Open Admin \u2014 Testing Reports", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-TESTING-REPO-04", "Confirm Testing Reports stayed on /settings/testing-reports", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("ADMIN-TESTING-REPO-05", "Run all UI audit rules on Admin Testing Reports", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
