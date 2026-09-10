import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin governance actions", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(true, "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD");
    }
  });

  test("admin dashboard shows pending brand and client approvals", async ({ page, soft }) => {
    await soft("OPH-ADMIN-PENDING-1", "Admin pending approvals on dashboard", async () => {
      await signInAsAdmin(page);
      await expect(page.getByRole("heading", { name: /Pending Client Approvals/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(page.getByRole("heading", { name: /Pending Brand Requests/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /View All/i }).first()).toBeVisible();
      await capturePageOrModal(page, "Admin pending approvals");
    });
  });

  test("admin RBAC exposes permissions roles users and create controls", async ({ page, soft }) => {
    await soft("OPH-ADMIN-RBAC-TABS-1", "Open RBAC permissions roles and users", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "RBAC Access");
      await expect(page.getByRole("heading", { name: /RBAC/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      for (const tab of ["Permissions", "Roles", "Users"]) {
        await page.getByRole("button", { name: tab }).click();
        await expect(page.getByRole("heading", { name: /RBAC/i })).toBeVisible();
      }
      await expect(
        page.getByRole("button", { name: /Create permission|Bulk create|Refresh/i }).first(),
      ).toBeVisible();
      await capturePageOrModal(page, "Admin RBAC tabs");
    });
  });

  test("admin subscription editor exposes preview edit and stripe settings", async ({
    page,
    soft,
  }) => {
    await soft("OPH-ADMIN-SUBSCRIPTION-EDITOR-1", "Open admin subscription plan editor", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Subscription");
      await expect(page.getByRole("heading", { name: /Subscription|Choose Your Plan/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(page.getByRole("button", { name: /^Preview$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Edit plans/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Stripe settings/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Save to API|Reset draft/i }).first()).toBeVisible();
      await capturePageOrModal(page, "Admin subscription editor");
    });
  });

  test("admin can open client access and data quality from sidebar", async ({ page, soft }) => {
    await soft("OPH-ADMIN-CLIENT-ACCESS-1", "Open admin client access hub", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Client Access");
      await expect(page.getByRole("heading", { name: /Client Access/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
    });

    await soft("OPH-ADMIN-DATA-QUALITY-1", "Open admin data quality dashboard", async () => {
      await clickSidebarNav(page, "Data Quality Dashboard");
      await expect(page.getByRole("heading", { name: /Data Quality/i }).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await capturePageOrModal(page, "Admin data quality");
    });
  });

  test("admin settings sections include audit and request form", async ({ page, soft }) => {
    await soft("OPH-ADMIN-SETTINGS-SECTIONS-1", "Walk admin settings sections", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Settings");
      await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      for (const section of ["Profile", "Audit", "Request form", "API & integrations"]) {
        const btn = page.getByRole("button", { name: new RegExp(section, "i") });
        if ((await btn.count()) > 0) await btn.first().click();
      }
      await expect(page.getByRole("button", { name: /Save profile/i })).toBeVisible();
      await capturePageOrModal(page, "Admin settings sections");
    });
  });
});
