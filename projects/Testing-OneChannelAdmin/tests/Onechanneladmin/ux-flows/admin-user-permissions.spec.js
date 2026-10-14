const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Admin",
  "name": "User Permissions",
  "path": "/settings/user-permission",
  "stepPrefix": "ADMIN-USER-PERMISS"
};

test("Admin: User Permissions UI UX audit", async ({ page }) => {
  await soft("ADMIN-USER-PERMISS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ADMIN-USER-PERMISS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ADMIN-USER-PERMISS-03", "Open Admin \u2014 User Permissions", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-USER-PERMISS-04", "Confirm User Permissions stayed on /settings/user-permission", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-USER-PERMISS-05", "Run all UI audit rules on Admin User Permissions", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
