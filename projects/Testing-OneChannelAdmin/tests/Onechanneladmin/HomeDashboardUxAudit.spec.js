const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./ux-flows/uxAuditSteps");

const entry = {
  hub: "Home",
  name: "Dashboard",
  path: "/home/dashboard",
  stepPrefix: "HD",
};

test("Home Dashboard UI UX audit", async ({ page }) => {
  await soft("HD-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("HD-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("HD-03", "Open Home Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("HD-04", "Run all UI audit rules on Home Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
