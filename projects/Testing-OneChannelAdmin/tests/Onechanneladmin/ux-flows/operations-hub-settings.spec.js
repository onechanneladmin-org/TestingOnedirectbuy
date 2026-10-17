const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Operations Hub",
  "name": "Settings",
  "path": "/operations/equipments",
  "stepPrefix": "OPERATIONS-HUB-SET"
};

test("Operations Hub: Settings UI UX audit", async ({ page }) => {
  await soft("OPERATIONS-HUB-SET-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("OPERATIONS-HUB-SET-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("OPERATIONS-HUB-SET-03", "Open Operations Hub \u2014 Settings", async () => {
    await openAdminPage(page, entry);
  });

  await soft("OPERATIONS-HUB-SET-04", "Confirm Settings stayed on /operations/equipments", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("OPERATIONS-HUB-SET-05", "Run all UI audit rules on Operations Hub Settings", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
