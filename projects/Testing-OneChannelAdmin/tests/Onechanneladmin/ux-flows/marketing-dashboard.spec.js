const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Marketing",
  "name": "Dashboard",
  "path": "/marketing/market-dashboard",
  "stepPrefix": "MARKETING-DASHBOAR"
};

test("Marketing: Dashboard UI UX audit", async ({ page }) => {
  await soft("MARKETING-DASHBOAR-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("MARKETING-DASHBOAR-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("MARKETING-DASHBOAR-03", "Open Marketing \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MARKETING-DASHBOAR-04", "Confirm Dashboard stayed on /marketing/market-dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("MARKETING-DASHBOAR-05", "Run all UI audit rules on Marketing Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
