const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Marketing",
  "name": "Email Marketing",
  "path": "/marketing/marketingemails",
  "stepPrefix": "MARKETING-EMAIL-MA"
};

test("Marketing: Email Marketing UI UX audit", async ({ page }) => {
  await soft("MARKETING-EMAIL-MA-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("MARKETING-EMAIL-MA-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("MARKETING-EMAIL-MA-03", "Open Marketing \u2014 Email Marketing", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MARKETING-EMAIL-MA-04", "Confirm Email Marketing stayed on /marketing/marketingemails", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MARKETING-EMAIL-MA-05", "Run all UI audit rules on Marketing Email Marketing", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
