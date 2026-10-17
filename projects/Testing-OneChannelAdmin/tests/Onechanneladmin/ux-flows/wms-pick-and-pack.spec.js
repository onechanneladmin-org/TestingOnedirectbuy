const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "WMS",
  "name": "Pick and Pack",
  "path": "/wms/pickpack",
  "stepPrefix": "WMS-PICK-AND-PACK"
};

test("WMS: Pick and Pack UI UX audit", async ({ page }) => {
  await soft("WMS-PICK-AND-PACK-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("WMS-PICK-AND-PACK-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("WMS-PICK-AND-PACK-03", "Open WMS \u2014 Pick and Pack", async () => {
    await openAdminPage(page, entry);
  });

  await soft("WMS-PICK-AND-PACK-04", "Confirm Pick and Pack stayed on /wms/pickpack", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("WMS-PICK-AND-PACK-05", "Run all UI audit rules on WMS Pick and Pack", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
