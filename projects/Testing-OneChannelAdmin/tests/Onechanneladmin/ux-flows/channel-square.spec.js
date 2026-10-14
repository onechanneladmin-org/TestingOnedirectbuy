const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "Square",
  "path": "/channel/square-products",
  "stepPrefix": "CHANNEL-SQUARE"
};

test("Channel: Square UI UX audit", async ({ page }) => {
  await soft("CHANNEL-SQUARE-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-SQUARE-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-SQUARE-03", "Open Channel \u2014 Square", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-SQUARE-04", "Confirm Square stayed on /channel/square-products", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-SQUARE-05", "Run all UI audit rules on Channel Square", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
