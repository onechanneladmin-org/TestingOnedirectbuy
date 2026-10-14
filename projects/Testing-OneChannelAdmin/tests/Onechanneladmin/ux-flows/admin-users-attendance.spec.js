const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Admin",
  "name": "Users Attendance",
  "path": "/settings/users-attendance",
  "stepPrefix": "ADMIN-USERS-ATTEND"
};

test("Admin: Users Attendance UI UX audit", async ({ page }) => {
  await soft("ADMIN-USERS-ATTEND-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ADMIN-USERS-ATTEND-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ADMIN-USERS-ATTEND-03", "Open Admin \u2014 Users Attendance", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-USERS-ATTEND-04", "Confirm Users Attendance stayed on /settings/users-attendance", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-USERS-ATTEND-05", "Run all UI audit rules on Admin Users Attendance", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
