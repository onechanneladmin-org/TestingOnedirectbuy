import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { hasAdminCredentials, signInAsAdmin } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  dismissDialog,
  navigateToHash,
  openSettingsSection,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin registry clients RBAC remaining", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(true, "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD");
    }
  });

  test("admin brand registry search tabs and modals cancel without save", async ({
    page,
    soft,
  }) => {
    await soft("OPH-ADMIN-REGISTRY-SEARCH-1", "Search brand registry", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Brand Registry");
      await expect(page.getByRole("heading", { name: /Brand Registry/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      const search = page.getByPlaceholder(/Search brands by name, key, email, or description/i);
      await expect(search).toBeVisible();
      await search.fill("TestBrand");
      await capturePageOrModal(page, "Admin registry search");
    });

    await soft("OPH-ADMIN-REGISTRY-TABS-1", "Switch approved requests revoked tabs", async () => {
      for (const tab of [/Approved Brands/i, /Approval Requests/i, /Revoked Access/i]) {
        await page.getByRole("button", { name: tab }).click();
      }
      await page.getByRole("button", { name: /Approved Brands/i }).click();
    });

    await soft("OPH-ADMIN-REGISTRY-FILTERS-1", "Open registry filters", async () => {
      await page.getByRole("button", { name: /^Filters$/i }).click();
      await capturePageOrModal(page, "Admin registry filters");
      await dismissDialog(page);
    });

    await soft("OPH-ADMIN-REGISTRY-ADD-CANCEL-1", "Open add brand then cancel", async () => {
      await page.getByRole("button", { name: /Add New Brand/i }).click();
      await capturePageOrModal(page, "Add brand modal");
      await dismissDialog(page);
      await expect(page.getByRole("heading", { name: /Brand Registry/i })).toBeVisible();
    });

    await soft("OPH-ADMIN-REGISTRY-ASSIGN-CANCEL-1", "Open assign user then cancel", async () => {
      await page.getByRole("button", { name: /Assign user to brand/i }).click();
      await capturePageOrModal(page, "Assign user modal");
      await dismissDialog(page);
    });
  });

  test("admin clients search tabs and invite stay UI-only", async ({ page, soft }) => {
    await soft("OPH-ADMIN-CLIENTS-SEARCH-1", "Search admin clients hub", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Clients");
      await expect(page.getByRole("heading", { name: /Client Access Hub|Client/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      const search = page.getByPlaceholder(/Search by name, email, or company/i);
      await expect(search).toBeVisible();
      await search.fill("srihari");
    });

    await soft("OPH-ADMIN-CLIENTS-TABS-1", "Switch pending approved denied client tabs", async () => {
      for (const tab of [/Pending/i, /Approved/i, /Denied/i]) {
        await page.getByRole("button", { name: tab }).first().click();
      }
      await capturePageOrModal(page, "Admin client tabs");
    });

    await soft("OPH-ADMIN-CLIENTS-INVITE-1", "Open invite client without sending", async () => {
      await page.getByRole("button", { name: /^Invite$/i }).click();
      await capturePageOrModal(page, "Admin invite client");
      await dismissDialog(page);
    });
  });

  test("admin RBAC filter and create permission cancel without save", async ({ page, soft }) => {
    await soft("OPH-ADMIN-RBAC-FILTER-1", "Filter RBAC permissions", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "RBAC Access");
      await expect(page.getByRole("heading", { name: /RBAC/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      const search = page.getByPlaceholder(/Search permissions/i);
      await expect(search).toBeVisible();
      await search.fill("product");
      await page.getByRole("button", { name: /Apply filter/i }).click();
    });

    await soft("OPH-ADMIN-RBAC-CREATE-CANCEL-1", "Open create permission then cancel", async () => {
      await page.getByRole("button", { name: /Create permission/i }).click();
      await capturePageOrModal(page, "Create permission");
      await dismissDialog(page);
      await expect(page.getByRole("heading", { name: /RBAC/i })).toBeVisible();
    });
  });

  test("admin remaining settings tabs and subscription preview without save", async ({
    page,
    soft,
  }) => {
    await soft("OPH-ADMIN-SETTINGS-ALL-TABS-1", "Walk remaining admin settings tabs", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Settings");
      await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      for (const section of [
        "General",
        "Notifications",
        "Email",
        "Security",
        "Branding",
        "Brand registry",
        "Categories",
        "Product feeds",
        "Feed & export",
        "Data & export",
        "Account",
      ]) {
        await openSettingsSection(page, section);
      }
      await capturePageOrModal(page, "Admin remaining settings");
    });

    await soft("OPH-ADMIN-SUB-PREVIEW-1", "Preview subscription without Save to API", async () => {
      await navigateToHash(page, "subscription");
      await expect(
        page.getByRole("heading", { name: /Choose Your Plan|Subscription/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      const preview = page
        .getByRole("button", { name: /^Preview$/i })
        .or(page.getByRole("tab", { name: /^Preview$/i }));
      await expect(preview.first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await preview.first().click();
      await expect(page.getByRole("button", { name: /Save to API/i })).toBeVisible();
      await capturePageOrModal(page, "Admin subscription preview");
    });
  });
});
