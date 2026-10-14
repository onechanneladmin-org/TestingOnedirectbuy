const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "1XA",
  "path": "/channel/onechanneladmin-products",
  "stepPrefix": "CHANNEL-1XA"
};

test("Channel: 1XA UI UX audit", async ({ page }) => {
  await soft("CHANNEL-1XA-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-1XA-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-1XA-03", "Open Channel \u2014 1XA", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-1XA-04", "Confirm 1XA stayed on /channel/onechanneladmin-products", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-1XA-05", "Run all UI audit rules on Channel 1XA", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
