const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Operations Hub",
  "name": "Raw Materials",
  "path": "/operations/raw-material",
  "stepPrefix": "OPERATIONS-HUB-RAW"
};

test("Operations Hub: Raw Materials UI UX audit", async ({ page }) => {
  await soft("OPERATIONS-HUB-RAW-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("OPERATIONS-HUB-RAW-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("OPERATIONS-HUB-RAW-03", "Open Operations Hub \u2014 Raw Materials", async () => {
    await openAdminPage(page, entry);
  });

  await soft("OPERATIONS-HUB-RAW-04", "Confirm Raw Materials stayed on /operations/raw-material", async () => {
    await openAdminPage(page, entry);
  });

  await soft("OPERATIONS-HUB-RAW-05", "Run all UI audit rules on Operations Hub Raw Materials", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
