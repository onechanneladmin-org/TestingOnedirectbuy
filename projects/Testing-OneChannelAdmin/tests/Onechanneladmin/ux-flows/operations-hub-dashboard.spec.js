const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Operations Hub",
  "name": "Dashboard",
  "path": "/operations/dashboard",
  "stepPrefix": "OPERATIONS-HUB-DAS"
};

test("Operations Hub: Dashboard UI UX audit", async ({ page }) => {
  await soft("OPERATIONS-HUB-DAS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("OPERATIONS-HUB-DAS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("OPERATIONS-HUB-DAS-03", "Open Operations Hub \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("OPERATIONS-HUB-DAS-04", "Confirm Dashboard stayed on /operations/dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("OPERATIONS-HUB-DAS-05", "Run all UI audit rules on Operations Hub Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
