const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Marketing",
  "name": "Geo Fencing",
  "path": "/marketing/geo-fencing",
  "stepPrefix": "MARKETING-GEO-FENC"
};

test("Marketing: Geo Fencing UI UX audit", async ({ page }) => {
  await soft("MARKETING-GEO-FENC-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("MARKETING-GEO-FENC-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("MARKETING-GEO-FENC-03", "Open Marketing \u2014 Geo Fencing", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MARKETING-GEO-FENC-04", "Confirm Geo Fencing stayed on /marketing/geo-fencing", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MARKETING-GEO-FENC-05", "Run all UI audit rules on Marketing Geo Fencing", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
