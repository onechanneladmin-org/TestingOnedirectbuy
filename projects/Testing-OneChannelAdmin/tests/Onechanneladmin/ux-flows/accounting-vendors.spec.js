const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Vendors",
  "path": "/accounting/vendors",
  "stepPrefix": "ACCOUNTING-VENDORS"
};

test("Accounting: Vendors UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-VENDORS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-VENDORS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-VENDORS-03", "Open Accounting \u2014 Vendors", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-VENDORS-04", "Confirm Vendors stayed on /accounting/vendors", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-VENDORS-05", "Run all UI audit rules on Accounting Vendors", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
