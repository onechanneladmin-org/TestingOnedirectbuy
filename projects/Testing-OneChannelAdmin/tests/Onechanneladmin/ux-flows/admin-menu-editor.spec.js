const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Admin",
  "name": "Menu Editor",
  "path": "/settings/pageflipcanvaseditor",
  "stepPrefix": "ADMIN-MENU-EDITOR"
};

test("Admin: Menu Editor UI UX audit", async ({ page }) => {
  await soft("ADMIN-MENU-EDITOR-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ADMIN-MENU-EDITOR-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ADMIN-MENU-EDITOR-03", "Open Admin \u2014 Menu Editor", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-MENU-EDITOR-04", "Confirm Menu Editor stayed on /settings/pageflipcanvaseditor", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ADMIN-MENU-EDITOR-05", "Run all UI audit rules on Admin Menu Editor", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
