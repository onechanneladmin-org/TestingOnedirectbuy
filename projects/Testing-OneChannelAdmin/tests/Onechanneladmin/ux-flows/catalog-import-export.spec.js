const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Catalog",
  "name": "Import / Export",
  "path": "/products/import-export",
  "stepPrefix": "CATALOG-IMPORT-EXP"
};

test("Catalog: Import / Export UI UX audit", async ({ page }) => {
  await soft("CATALOG-IMPORT-EXP-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CATALOG-IMPORT-EXP-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CATALOG-IMPORT-EXP-03", "Open Catalog \u2014 Import / Export", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-IMPORT-EXP-04", "Confirm Import / Export stayed on /products/import-export", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CATALOG-IMPORT-EXP-05", "Run all UI audit rules on Catalog Import / Export", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
