const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "PO Outbound",
  "path": "/wms/purchaseorders?warehouse=wh1",
  "stepPrefix": "WMS-PO-OUTBOUND"
};

test("WMS: PO Outbound UI UX audit", async ({ page }) => {
  await soft("WMS-PO-OUTBOUND-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-PO-OUTBOUND-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-PO-OUTBOUND-03", "Open WMS \u2014 PO Outbound", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-PO-OUTBOUND-04", "Confirm PO Outbound stayed on /wms/purchaseorders?warehouse=wh1", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-PO-OUTBOUND-05", "Run all UI audit rules on WMS PO Outbound", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
