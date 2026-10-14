const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Catalog",
  "name": "Fitment",
  "path": "/products/fitment",
  "stepPrefix": "CATALOG-FITMENT"
};

test("Catalog: Fitment UI UX audit", async ({ page }) => {
  await soft("CATALOG-FITMENT-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CATALOG-FITMENT-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CATALOG-FITMENT-03", "Open Catalog \u2014 Fitment", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-FITMENT-04", "Confirm Fitment stayed on /products/fitment", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-FITMENT-05", "Run all UI audit rules on Catalog Fitment", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
