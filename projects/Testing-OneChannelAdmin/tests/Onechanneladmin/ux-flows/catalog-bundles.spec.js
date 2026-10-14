const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Catalog",
  "name": "Bundles",
  "path": "/products/bundlekits",
  "stepPrefix": "CATALOG-BUNDLES"
};

test("Catalog: Bundles UI UX audit", async ({ page }) => {
  await soft("CATALOG-BUNDLES-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CATALOG-BUNDLES-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CATALOG-BUNDLES-03", "Open Catalog \u2014 Bundles", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-BUNDLES-04", "Confirm Bundles stayed on /products/bundlekits", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-BUNDLES-05", "Run all UI audit rules on Catalog Bundles", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
