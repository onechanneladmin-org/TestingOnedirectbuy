const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "Amazon",
  "path": "/channel/amazon-dashboard",
  "stepPrefix": "CHANNEL-AMAZON"
};

test("Channel: Amazon UI UX audit", async ({ page }) => {
  await soft("CHANNEL-AMAZON-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-AMAZON-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-AMAZON-03", "Open Channel \u2014 Amazon", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-AMAZON-04", "Confirm Amazon stayed on /channel/amazon-dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CHANNEL-AMAZON-05", "Run all UI audit rules on Channel Amazon", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
