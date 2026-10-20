const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Map Price",
  "name": "Settings",
  "path": "/map-price/settings",
  "stepPrefix": "MAP-PRICE-SETTINGS"
};

test("Map Price: Settings UI UX audit", async ({ page }) => {
  await soft("MAP-PRICE-SETTINGS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("MAP-PRICE-SETTINGS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("MAP-PRICE-SETTINGS-03", "Open Map Price \u2014 Settings", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MAP-PRICE-SETTINGS-04", "Confirm Settings stayed on /map-price/settings", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("MAP-PRICE-SETTINGS-05", "Run all UI audit rules on Map Price Settings", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
