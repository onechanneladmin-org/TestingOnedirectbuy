const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Blind Receive",
  "path": "/wms/blindRecieve",
  "stepPrefix": "WMS-BLIND-RECEIVE"
};

test("WMS: Blind Receive UI UX audit", async ({ page }) => {
  await soft("WMS-BLIND-RECEIVE-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-BLIND-RECEIVE-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-BLIND-RECEIVE-03", "Open WMS \u2014 Blind Receive", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-BLIND-RECEIVE-04", "Confirm Blind Receive stayed on /wms/blindRecieve", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-BLIND-RECEIVE-05", "Run all UI audit rules on WMS Blind Receive", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
