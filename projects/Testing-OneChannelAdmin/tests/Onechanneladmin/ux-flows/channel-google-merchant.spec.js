const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "Google Merchant",
  "path": "/channel/google-merchant-products",
  "stepPrefix": "CHANNEL-GOOGLE-MER"
};

test("Channel: Google Merchant UI UX audit", async ({ page }) => {
  await soft("CHANNEL-GOOGLE-MER-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-GOOGLE-MER-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-GOOGLE-MER-03", "Open Channel \u2014 Google Merchant", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-GOOGLE-MER-04", "Confirm Google Merchant stayed on /channel/google-merchant-products", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CHANNEL-GOOGLE-MER-05", "Run all UI audit rules on Channel Google Merchant", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
