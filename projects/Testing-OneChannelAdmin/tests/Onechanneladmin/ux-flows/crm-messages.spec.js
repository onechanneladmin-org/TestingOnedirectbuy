const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "CRM",
  "name": "Messages",
  "path": "/marketing/engage-messages",
  "stepPrefix": "CRM-MESSAGES"
};

test("CRM: Messages UI UX audit", async ({ page }) => {
  await soft("CRM-MESSAGES-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CRM-MESSAGES-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CRM-MESSAGES-03", "Open CRM \u2014 Messages", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CRM-MESSAGES-04", "Confirm Messages stayed on /marketing/engage-messages", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("CRM-MESSAGES-05", "Run all UI audit rules on CRM Messages", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
