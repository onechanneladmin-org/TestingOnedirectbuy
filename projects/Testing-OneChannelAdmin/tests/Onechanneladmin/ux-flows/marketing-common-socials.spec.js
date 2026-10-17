const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Marketing",
  "name": "Common Socials",
  "path": "/marketing/common-socials",
  "stepPrefix": "MARKETING-COMMON-S"
};

test("Marketing: Common Socials UI UX audit", async ({ page }) => {
  await soft("MARKETING-COMMON-S-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("MARKETING-COMMON-S-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("MARKETING-COMMON-S-03", "Open Marketing \u2014 Common Socials", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MARKETING-COMMON-S-04", "Confirm Common Socials stayed on /marketing/common-socials", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("MARKETING-COMMON-S-05", "Run all UI audit rules on Marketing Common Socials", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
