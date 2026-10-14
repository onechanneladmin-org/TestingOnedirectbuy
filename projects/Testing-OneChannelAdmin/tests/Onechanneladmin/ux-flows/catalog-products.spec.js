const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Catalog",
  "name": "Products",
  "path": "/products/catalog",
  "stepPrefix": "CATALOG-PRODUCTS"
};

test("Catalog: Products UI UX audit", async ({ page }) => {
  await soft("CATALOG-PRODUCTS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CATALOG-PRODUCTS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CATALOG-PRODUCTS-03", "Open Catalog \u2014 Products", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-PRODUCTS-04", "Confirm Products stayed on /products/catalog", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-PRODUCTS-05", "Run all UI audit rules on Catalog Products", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
