const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "eBay",
  "path": "/channel/ebay-dashboard",
  "stepPrefix": "CHANNEL-EBAY"
};

test("Channel: eBay UI UX audit", async ({ page }) => {
  await soft("CHANNEL-EBAY-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-EBAY-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-EBAY-03", "Open Channel \u2014 eBay", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-EBAY-04", "Confirm eBay stayed on /channel/ebay-dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-EBAY-05", "Run all UI audit rules on Channel eBay", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
