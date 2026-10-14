const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Non-Inventory Items",
  "path": "/wms/non_inventory_item?warehouse=all",
  "stepPrefix": "WMS-NON-INVENTORY-"
};

test("WMS: Non-Inventory Items UI UX audit", async ({ page }) => {
  await soft("WMS-NON-INVENTORY--01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-NON-INVENTORY--02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-NON-INVENTORY--03", "Open WMS \u2014 Non-Inventory Items", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-NON-INVENTORY--04", "Confirm Non-Inventory Items stayed on /wms/non_inventory_item?warehouse=all", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-NON-INVENTORY--05", "Run all UI audit rules on WMS Non-Inventory Items", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
