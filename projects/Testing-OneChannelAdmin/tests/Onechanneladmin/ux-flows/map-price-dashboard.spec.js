const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Map Price",
  "name": "Dashboard",
  "path": "/map-price/dashboard",
  "stepPrefix": "MAP-PRICE-DASHBOAR"
};

test("Map Price: Dashboard UI UX audit", async ({ page }) => {
  await soft("MAP-PRICE-DASHBOAR-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("MAP-PRICE-DASHBOAR-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("MAP-PRICE-DASHBOAR-03", "Open Map Price \u2014 Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MAP-PRICE-DASHBOAR-04", "Confirm Dashboard stayed on /map-price/dashboard", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MAP-PRICE-DASHBOAR-05", "Run all UI audit rules on Map Price Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
