const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "OneDirectBuy",
  "path": "/marketplaceseller",
  "stepPrefix": "CHANNEL-ONEDIRECTB"
};

test("Channel: OneDirectBuy UI UX audit", async ({ page }) => {
  await soft("CHANNEL-ONEDIRECTB-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-ONEDIRECTB-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-ONEDIRECTB-03", "Open Channel \u2014 OneDirectBuy", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-ONEDIRECTB-04", "Confirm OneDirectBuy stayed on /marketplaceseller", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CHANNEL-ONEDIRECTB-05", "Run all UI audit rules on Channel OneDirectBuy", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
