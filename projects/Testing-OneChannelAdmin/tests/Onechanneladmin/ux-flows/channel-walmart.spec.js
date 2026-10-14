const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "Walmart",
  "path": "/channel/walmart-dashboard",
  "stepPrefix": "CHANNEL-WALMART"
};

test("Channel: Walmart UI UX audit", async ({ page }) => {
  await soft("CHANNEL-WALMART-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-WALMART-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-WALMART-03", "Open Channel \u2014 Walmart", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-WALMART-04", "Confirm Walmart stayed on /channel/walmart-dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-WALMART-05", "Run all UI audit rules on Channel Walmart", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
