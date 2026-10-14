const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Accounting",
  "name": "Journal Entries",
  "path": "/accounting/journal-entries",
  "stepPrefix": "ACCOUNTING-JOURNAL"
};

test("Accounting: Journal Entries UI UX audit", async ({ page }) => {
  await soft("ACCOUNTING-JOURNAL-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("ACCOUNTING-JOURNAL-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("ACCOUNTING-JOURNAL-03", "Open Accounting \u2014 Journal Entries", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-JOURNAL-04", "Confirm Journal Entries stayed on /accounting/journal-entries", async () => {
    await openAdminPage(page, entry);
  });

  await soft("ACCOUNTING-JOURNAL-05", "Run all UI audit rules on Accounting Journal Entries", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
