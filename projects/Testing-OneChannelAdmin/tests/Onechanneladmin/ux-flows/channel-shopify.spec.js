const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "Shopify",
  "path": "/channel/shopify-dashboard",
  "stepPrefix": "CHANNEL-SHOPIFY"
};

test("Channel: Shopify UI UX audit", async ({ page }) => {
  await soft("CHANNEL-SHOPIFY-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-SHOPIFY-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-SHOPIFY-03", "Open Channel \u2014 Shopify", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-SHOPIFY-04", "Confirm Shopify stayed on /channel/shopify-dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CHANNEL-SHOPIFY-05", "Run all UI audit rules on Channel Shopify", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
