const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../../helpers/flowStep");
const { openSignIn, signIn, openAdminPage, runFullUxAudit } = require("./uxAuditSteps");

const entry = {
  "hub": "Fulfillment",
  "name": "Labels Printing",
  "path": "/fulfill/settings/label-printing",
  "stepPrefix": "FULFILLMENT-LABELS"
};

test("Fulfillment: Labels Printing UI UX audit", async ({ page }) => {
  await soft("FULFILLMENT-LABELS-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("FULFILLMENT-LABELS-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("FULFILLMENT-LABELS-03", "Open Fulfillment \u2014 Labels Printing", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-LABELS-04", "Confirm Labels Printing stayed on /fulfill/settings/label-printing", async () => {
    await openAdminPage(page, entry);
  });

  await soft("FULFILLMENT-LABELS-05", "Run all UI audit rules on Fulfillment Labels Printing", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
