const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "Etsy",
  "path": "/channel/etsy-dashboard",
  "stepPrefix": "CHANNEL-ETSY"
};

test("Channel: Etsy UI UX audit", async ({ page }) => {
  await soft("CHANNEL-ETSY-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-ETSY-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-ETSY-03", "Open Channel \u2014 Etsy", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-ETSY-04", "Confirm Etsy stayed on /channel/etsy-dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CHANNEL-ETSY-05", "Run all UI audit rules on Channel Etsy", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
