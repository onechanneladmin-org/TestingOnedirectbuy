const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Tax Rates",
  "path": "/fulfill/settings/taxRates",
  "stepPrefix": "FULFILLMENT-TAX-RA"
};

test("Fulfillment: Tax Rates UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-TAX-RA-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-TAX-RA-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-TAX-RA-03", "Open Fulfillment \u2014 Tax Rates", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-TAX-RA-04", "Confirm Tax Rates stayed on /fulfill/settings/taxRates", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-TAX-RA-05", "Run all UI audit rules on Fulfillment Tax Rates", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
