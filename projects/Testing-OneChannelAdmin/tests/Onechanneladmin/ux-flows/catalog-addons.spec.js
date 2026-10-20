const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Catalog",
  "name": "Addons",
  "path": "/products/addons",
  "stepPrefix": "CATALOG-ADDONS"
};

test("Catalog: Addons UI UX audit", async ({ page }) => {
  await soft("CATALOG-ADDONS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CATALOG-ADDONS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CATALOG-ADDONS-03", "Open Catalog \u2014 Addons", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-ADDONS-04", "Confirm Addons stayed on /products/addons", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CATALOG-ADDONS-05", "Run all UI audit rules on Catalog Addons", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
