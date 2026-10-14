const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "AP/AR Workflows",
  "path": "/accounting/apar-workflows",
  "stepPrefix": "ACCOUNTING-AP-AR-W"
};

test("Accounting: AP/AR Workflows UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-AP-AR-W-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-AP-AR-W-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-AP-AR-W-03", "Open Accounting \u2014 AP/AR Workflows", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-AP-AR-W-04", "Confirm AP/AR Workflows stayed on /accounting/apar-workflows", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-AP-AR-W-05", "Run all UI audit rules on Accounting AP/AR Workflows", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
