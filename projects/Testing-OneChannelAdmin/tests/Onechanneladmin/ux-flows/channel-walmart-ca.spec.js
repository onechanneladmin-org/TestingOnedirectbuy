const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "Walmart CA",
  "path": "/channel/walmartca-dashboard",
  "stepPrefix": "CHANNEL-WALMART-CA"
};

test("Channel: Walmart CA UI UX audit", async ({ page }) => {
  await soft("CHANNEL-WALMART-CA-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-WALMART-CA-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-WALMART-CA-03", "Open Channel \u2014 Walmart CA", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-WALMART-CA-04", "Confirm Walmart CA stayed on /channel/walmartca-dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-WALMART-CA-05", "Run all UI audit rules on Channel Walmart CA", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
