const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Catalog",
  "name": "Pricing",
  "path": "/products/pricing",
  "stepPrefix": "CATALOG-PRICING"
};

test("Catalog: Pricing UI UX audit", async ({ page }) => {
  await soft("CATALOG-PRICING-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CATALOG-PRICING-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CATALOG-PRICING-03", "Open Catalog \u2014 Pricing", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-PRICING-04", "Confirm Pricing stayed on /products/pricing", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-PRICING-05", "Run all UI audit rules on Catalog Pricing", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
