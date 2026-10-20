const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "B2B",
  "path": "/channel/b2b-products",
  "stepPrefix": "CHANNEL-B2B"
};

test("Channel: B2B UI UX audit", async ({ page }) => {
  await soft("CHANNEL-B2B-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-B2B-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-B2B-03", "Open Channel \u2014 B2B", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-B2B-04", "Confirm B2B stayed on /channel/b2b-products", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CHANNEL-B2B-05", "Run all UI audit rules on Channel B2B", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
