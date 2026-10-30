const { test } = require("@playwright/test");
const { flowStep: soft, reportFlowIssue } = require("../helpers/flowStep");
const {
  openSignIn,
  signIn,
  openAdminPage,
  selectDateRange,
  scrollThroughPage,
  runFullUxAudit,
  runUserActionSteps,
} = require("./ux-flows/uxAuditSteps");

const entry = {
  hub: "Home",
  name: "Dashboard",
  path: "/home/dashboard",
  stepPrefix: "HD",
};

test("Home Dashboard UI UX audit", async ({ page }) => {
  await soft("HD-01", "Open the admin sign-in page", async () => {
    await openSignIn(page);
  });

  await soft("HD-02", "Sign in as admin", async () => {
    await signIn(page);
  });

  await soft("HD-03", "Open Home Dashboard", async () => {
    await openAdminPage(page, entry);
  });

  // The dashboard opens on "Today". Widen it to "This year" so the audit sees populated charts
  // and tables rather than a page of empty states, then mount everything below the fold.
  await soft("HD-03A", "Select the This year date range and wait for data", async () => {
    await selectDateRange(page, "This year");
  });

  await soft("HD-03B", "Scroll to the bottom and validate every component loaded", async () => {
    await scrollThroughPage(page);
  });

  await soft(entry.stepPrefix + "-05A", "List user actions, run each one, and return to this page", async () => {
    await runUserActionSteps(page, entry, soft);
  });

  await soft("HD-04", "Run all UI audit rules on Home Dashboard", async () => {
    await runFullUxAudit(page, entry, reportFlowIssue);
  });
});
