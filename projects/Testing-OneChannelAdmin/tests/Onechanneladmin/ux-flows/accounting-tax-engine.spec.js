const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Tax Engine",
  "path": "/accounting/tax-engine",
  "stepPrefix": "ACCOUNTING-TAX-ENG"
};

test("Accounting: Tax Engine UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-TAX-ENG-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-TAX-ENG-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-TAX-ENG-03", "Open Accounting \u2014 Tax Engine", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-TAX-ENG-04", "Confirm Tax Engine stayed on /accounting/tax-engine", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-TAX-ENG-05", "Run all UI audit rules on Accounting Tax Engine", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
