const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Channel",
  "name": "Facebook",
  "path": "/channel/facebook-products",
  "stepPrefix": "CHANNEL-FACEBOOK"
};

test("Channel: Facebook UI UX audit", async ({ page }) => {
  await soft("CHANNEL-FACEBOOK-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CHANNEL-FACEBOOK-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CHANNEL-FACEBOOK-03", "Open Channel \u2014 Facebook", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-FACEBOOK-04", "Confirm Facebook stayed on /channel/facebook-products", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CHANNEL-FACEBOOK-05", "Run all UI audit rules on Channel Facebook", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
