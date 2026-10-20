const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Returns",
  "path": "/wms/returns",
  "stepPrefix": "WMS-RETURNS"
};

test("WMS: Returns UI UX audit", async ({ page }) => {
  await soft("WMS-RETURNS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-RETURNS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-RETURNS-03", "Open WMS \u2014 Returns", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-RETURNS-04", "Confirm Returns stayed on /wms/returns", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("WMS-RETURNS-05", "Run all UI audit rules on WMS Returns", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
