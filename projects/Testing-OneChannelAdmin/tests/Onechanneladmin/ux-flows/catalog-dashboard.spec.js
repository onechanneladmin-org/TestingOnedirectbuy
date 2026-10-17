const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Catalog",
  "name": "Dashboard",
  "path": "/products/dashboard",
  "stepPrefix": "CATALOG-DASHBOARD"
};

test("Catalog: Dashboard UI UX audit", async ({ page }) => {
  await soft("CATALOG-DASHBOARD-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CATALOG-DASHBOARD-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CATALOG-DASHBOARD-03", "Open Catalog \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-DASHBOARD-04", "Confirm Dashboard stayed on /products/dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CATALOG-DASHBOARD-05", "Run all UI audit rules on Catalog Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
