const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Catalog",
  "name": "Images",
  "path": "/products/images",
  "stepPrefix": "CATALOG-IMAGES"
};

test("Catalog: Images UI UX audit", async ({ page }) => {
  await soft("CATALOG-IMAGES-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("CATALOG-IMAGES-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("CATALOG-IMAGES-03", "Open Catalog \u2014 Images", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-IMAGES-04", "Confirm Images stayed on /products/images", async () => {
    await openAdminPage(page, entry);
  });

  await soft("CATALOG-IMAGES-05", "Run all UI audit rules on Catalog Images", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
