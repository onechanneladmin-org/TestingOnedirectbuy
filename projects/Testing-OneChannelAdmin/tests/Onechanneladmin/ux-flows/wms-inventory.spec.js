const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Inventory",
  "path": "/wms/inventory?warehouse=all",
  "stepPrefix": "WMS-INVENTORY"
};

test("WMS: Inventory UI UX audit", async ({ page }) => {
  await soft("WMS-INVENTORY-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-INVENTORY-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-INVENTORY-03", "Open WMS \u2014 Inventory", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-INVENTORY-04", "Confirm Inventory stayed on /wms/inventory?warehouse=all", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-INVENTORY-05", "Run all UI audit rules on WMS Inventory", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
