const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit, runUserActionSteps } = require("./uxAuditSteps");

const entry = {
  "hub": "Marketing",
  "name": "Discounts",
  "path": "/marketing/campaigns",
  "stepPrefix": "MARKETING-DISCOUNT"
};

test("Marketing: Discounts UI UX audit", async ({ page }) => {
  await soft("MARKETING-DISCOUNT-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("MARKETING-DISCOUNT-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("MARKETING-DISCOUNT-03", "Open Marketing \u2014 Discounts", async () => {
    await openAdminPage(page, entry);
  });

  await soft("MARKETING-DISCOUNT-04", "Confirm Discounts stayed on /marketing/campaigns", async () => {
    await openAdminPage(page, entry);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("MARKETING-DISCOUNT-05", "Run all UI audit rules on Marketing Discounts", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
