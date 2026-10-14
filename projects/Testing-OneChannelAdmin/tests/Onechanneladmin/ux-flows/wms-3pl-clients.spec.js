const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "3PL Clients",
  "path": "/wms/3plclients",
  "stepPrefix": "WMS-3PL-CLIENTS"
};

test("WMS: 3PL Clients UI UX audit", async ({ page }) => {
  await soft("WMS-3PL-CLIENTS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-3PL-CLIENTS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-3PL-CLIENTS-03", "Open WMS \u2014 3PL Clients", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-3PL-CLIENTS-04", "Confirm 3PL Clients stayed on /wms/3plclients", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-3PL-CLIENTS-05", "Run all UI audit rules on WMS 3PL Clients", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
