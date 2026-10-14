const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Put Away",
  "path": "/wms/putaway",
  "stepPrefix": "WMS-PUT-AWAY"
};

test("WMS: Put Away UI UX audit", async ({ page }) => {
  await soft("WMS-PUT-AWAY-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-PUT-AWAY-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-PUT-AWAY-03", "Open WMS \u2014 Put Away", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-PUT-AWAY-04", "Confirm Put Away stayed on /wms/putaway", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-PUT-AWAY-05", "Run all UI audit rules on WMS Put Away", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
