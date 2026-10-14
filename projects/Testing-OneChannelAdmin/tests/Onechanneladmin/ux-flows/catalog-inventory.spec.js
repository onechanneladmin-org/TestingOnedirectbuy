const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Catalog",
  "name": "Inventory",
  "path": "/products/inventory",
  "stepPrefix": "CATALOG-INVENTORY"
};

test("Catalog: Inventory UI UX audit", async ({ page }) => {
  await soft("CATALOG-INVENTORY-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CATALOG-INVENTORY-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CATALOG-INVENTORY-03", "Open Catalog \u2014 Inventory", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-INVENTORY-04", "Confirm Inventory stayed on /products/inventory", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-INVENTORY-05", "Run all UI audit rules on Catalog Inventory", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
