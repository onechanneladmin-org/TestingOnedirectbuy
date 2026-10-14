const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Operations Hub",
  "name": "Production",
  "path": "/operations/production",
  "stepPrefix": "OPERATIONS-HUB-PRO"
};

test("Operations Hub: Production UI UX audit", async ({ page }) => {
  await soft("OPERATIONS-HUB-PRO-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("OPERATIONS-HUB-PRO-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("OPERATIONS-HUB-PRO-03", "Open Operations Hub \u2014 Production", async () => {
    await openAdminPage(page, entry);
  });

  await soft("OPERATIONS-HUB-PRO-04", "Confirm Production stayed on /operations/production", async () => {
    await openAdminPage(page, entry);
  });

  await soft("OPERATIONS-HUB-PRO-05", "Run all UI audit rules on Operations Hub Production", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
