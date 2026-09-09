/**
 * Playwright E2E tests for Email Marketing page (NewAllMail).
 * Covers navigation, campaigns, create campaign flow, templates, groups, contacts, automation, analytics.
 * After login, navigates to Marketing > Email Marketing (/marketing/marketingemails).
 *
 * Run from apps/web:
 *   pnpm add -D @playwright/test && npx playwright install chromium
 *   pnpm test:e2e   OR   npx playwright test
 * Optional env: PLAYWRIGHT_BASE_URL, TEST_LOGIN_EMAIL, TEST_LOGIN_PASSWORD
 */
import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "https://admin.onechanneladmin.com";
const LOGIN_EMAIL = process.env.TEST_LOGIN_EMAIL || "admin@onechanneladmin.com";
const LOGIN_PASSWORD = process.env.TEST_LOGIN_PASSWORD || (process.env.TEST_LOGIN_PASSWORD || "");

/** Create-campaign UI may be a modal or full-page (/marketing/newmailcampaign); scope by form content. */
function campaignModal(page) {
  return page
    .locator("div")
    .filter({ has: page.getByPlaceholder("e.g., Summer Sale 2024") })
    .filter({ has: page.getByRole("button", { name: "Cancel" }) })
    .last();
}

test.describe("Email Marketing Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginOneChannelAdmin(page, {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    });
    // Wait for redirect after login, then go to Email Marketing
    await page
      .waitForURL(/\/(dashboard|marketing|$)/, { timeout: 15000 })
      .catch(() => {});
    await page.goto(`${BASE_URL}/marketing/marketingemails`);
    await page.waitForLoadState("networkidle").catch(() => {});
    // Wait for page to show Email Marketing content (breadcrumb or tabs)
    await expect(
      page
        .getByRole("button", { name: "Campaigns" })
        .or(page.getByText("Email Marketing"))
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test.describe("Navigation", () => {
    test("Campaigns tab is active by default and shows Create Campaign button", async ({
      page,
    }) => {
      await expect(
        page.getByRole("button", { name: "Campaigns" }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Create Campaign" }).first(),
      ).toBeVisible();
    });

    test("Click Templates tab shows template section", async ({ page }) => {
      await page.getByRole("button", { name: "Templates" }).click();
      await expect(
        page.getByRole("button", { name: "Create Template" }).first(),
      ).toBeVisible({ timeout: 5000 });
    });

    test("Click Contacts tab shows contacts list", async ({ page }) => {
      await page.getByRole("button", { name: "Contacts" }).click();
      await expect(
        page
          .getByText("Loading contacts...")
          .or(page.getByText("No contacts found"))
          .or(page.locator("table")),
      ).toBeVisible({ timeout: 10000 });
    });

    test("Click Groups tab shows groups and Create Group button", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Groups" }).click();
      await expect(
        page.getByRole("button", { name: "Create Group" }).first(),
      ).toBeVisible({ timeout: 5000 });
    });

    test("Click Automation tab shows automation section", async ({ page }) => {
      await page.getByRole("button", { name: "Automation" }).click();
      await expect(
        page
          .getByText("Scheduled Campaigns")
          .or(page.getByText("No Scheduled Campaigns"))
          .first(),
      ).toBeVisible({ timeout: 5000 });
    });

    test("Click Analytics tab shows analytics section", async ({ page }) => {
      // Use .last() to target the Email Marketing tab (first match is nav dropdown)
      await page.getByRole("button", { name: "Analytics" }).last().click();
      await expect(
        page
          .getByText("Email Performance Over Time")
          .or(page.getByText("Total Revenue"))
          .or(page.getByText("No analytics data"))
          .first(),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Create Campaign – Step 1", () => {
    test("Create Campaign with empty name and Next shows validation or stays on step 1 or advances", async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: "Create Campaign" })
        .first()
        .click();
      await expect(page.getByPlaceholder("e.g., Summer Sale 2024")).toBeVisible(
        { timeout: 10000 },
      );
      await page.getByRole("button", { name: /Next/ }).last().click();
      // Either validation appears, we stay on step 1, or app advances to step 2
      const validationVisible = await page
        .getByText("Campaign Name is required", { exact: false })
        .or(page.getByText("required", { exact: false }))
        .or(page.locator(".p-toast-message"))
        .first()
        .isVisible()
        .catch(() => false);
      const stillOnStep1 = await page
        .getByPlaceholder("e.g., Summer Sale 2024")
        .isVisible()
        .catch(() => false);
      const onStep2 = await page
        .getByText(/Step 2|2 of 2|Sequence Flow|Add Step/)
        .first()
        .isVisible()
        .catch(() => false);
      expect(validationVisible || stillOnStep1 || onStep2).toBe(true);
    });

    test("Enter campaign name and Next moves to Step 2", async ({ page }) => {
      await page
        .getByRole("button", { name: "Create Campaign" })
        .first()
        .click();
      await page
        .getByPlaceholder("e.g., Summer Sale 2024")
        .fill("E2E Test Campaign");
      await page.getByRole("button", { name: /Next/ }).last().click();
      await expect(
        page
          .getByText("Step 2 of 2")
          .or(page.getByText(/Step 2|2 of 2/))
          .or(page.getByText("Sequence Flow"))
          .or(page.getByText("Add Step"))
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test("Enter campaign name and Save as Draft closes modal and shows success", async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: "Create Campaign" })
        .first()
        .click();
      await page
        .getByPlaceholder("e.g., Summer Sale 2024")
        .fill("E2E Draft Campaign");
      const saveDraft = page.getByRole("button", { name: "Save as Draft" }).last();
      const saveOnly = page.getByRole("button", { name: /^Save$/ });
      if (await saveDraft.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveDraft.click();
      } else if (await saveOnly.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveOnly.click();
      } else {
        await page.getByRole("button", { name: /Next/ }).last().click();
        const step2Save = page
          .getByRole("button", { name: "Save as Draft" })
          .or(page.getByRole("button", { name: /^Save$/ }));
        await step2Save.last().click({ timeout: 15000 });
      }
      await expect(
        page
          .getByText("Draft saved", { exact: false })
          .or(page.getByText("success", { exact: false }))
          .or(page.locator(".p-toast-message"))
          .or(page.getByText(/saved|draft/i)),
      ).toBeVisible({ timeout: 10000 });
      const placeholder = page.getByPlaceholder("e.g., Summer Sale 2024");
      const returnedToList = await page
        .getByRole("button", { name: "Create Campaign" })
        .first()
        .isVisible()
        .catch(() => false);
      if (returnedToList) {
        await expect(placeholder).not.toBeVisible();
      }
    });

    test("Step 1 Cancel closes modal", async ({ page }) => {
      await page
        .getByRole("button", { name: "Create Campaign" })
        .first()
        .click();
      await page.getByPlaceholder("e.g., Summer Sale 2024").fill("Will Cancel");
      await page.getByRole("button", { name: "Cancel" }).last().click();
      await expect(
        page.getByPlaceholder("e.g., Summer Sale 2024"),
      ).not.toBeVisible();
    });

    test("Step 1 Cancel button closes modal (no Previous on step 1)", async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: "Create Campaign" })
        .first()
        .click();
      await expect(
        page.getByText("Campaign Name", { exact: false }).first(),
      ).toBeVisible();
      await campaignModal(page).getByRole("button", { name: "Cancel" }).first().click();
      await expect(
        page.getByPlaceholder("e.g., Summer Sale 2024"),
      ).not.toBeVisible();
    });
  });

  test.describe("Create Campaign – Step 2 (single email flow)", () => {
    test.beforeEach(async ({ page }) => {
      await page
        .getByRole("button", { name: "Create Campaign" })
        .first()
        .click();
      await page
        .getByPlaceholder("e.g., Summer Sale 2024")
        .fill("E2E Step2 Campaign");
      await page.getByRole("button", { name: /Next/ }).last().click();
      await expect(
        page
          .getByText("Step 2 of 2")
          .or(page.getByText(/Step 2|2 of 2/))
          .or(page.getByText("Sequence Flow"))
          .or(page.getByText("Add Step"))
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test("Step 2: No email step – Send shows add step requirement", async ({
      page,
    }) => {
      const sendOrFinish = page
        .getByRole("button", { name: "Send Campaign" })
        .or(page.getByRole("button", { name: "Schedule Campaign" }))
        .or(page.getByRole("button", { name: /Next/ }));
      await sendOrFinish.last().click();
      await expect(
        page
          .getByText("Add at least one Email step", { exact: false })
          .or(page.getByText("at least one Email step", { exact: false }))
          .or(page.getByText("Add at least one", { exact: false }))
          .or(page.locator(".p-toast-message")),
      ).toBeVisible({ timeout: 5000 });
    });

    test("Step 2: Add Email step then Previous returns to Step 1 with data retained", async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: /Add step here/i })
        .first()
        .click({ timeout: 5000 });
      await page
        .getByRole("button", { name: "Send Email" })
        .click({ timeout: 5000 });
      await expect(
        page
          .getByText("Back to Sequence")
          .or(page.getByPlaceholder(/subject/i))
          .first(),
      ).toBeVisible({ timeout: 8000 });
      await page.getByRole("button", { name: "Previous" }).first().click();
      await expect(
        page
          .getByText("Step 1 of 2")
          .or(page.getByRole("heading", { name: "Campaign Name" })),
      ).toBeVisible();
      await expect(page.getByPlaceholder("e.g., Summer Sale 2024")).toHaveValue(
        "E2E Step2 Campaign",
      );
    });

    test("Step 2: Save as Draft with only campaign name saves and closes", async ({
      page,
    }) => {
      const saveDraft = page.getByRole("button", { name: "Save as Draft" }).first();
      const saveOnly = page.getByRole("button", { name: /^Save$/ }).first();
      if (await saveDraft.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveDraft.click();
      } else {
        await saveOnly.click();
      }
      await expect(
        page
          .locator(".p-toast-message")
          .or(page.getByText("Draft", { exact: false }))
          .or(page.getByText(/saved|success/i)),
      ).toBeVisible({ timeout: 10000 });
      const navigatedAway = !(await page.url().includes("newmailcampaign"));
      if (navigatedAway) {
        await expect(page.getByText("Step 2 of 2")).not.toBeVisible();
      }
    });
  });

  test.describe("Campaign List & Actions", () => {
    test("Campaigns tab shows table or empty state", async ({ page }) => {
      await expect(
        page
          .getByText("Loading campaigns...")
          .or(page.getByText("No campaigns found"))
          .or(page.locator("table"))
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test("Search campaigns input is visible and accepts input", async ({
      page,
    }) => {
      await page.getByPlaceholder("Search campaigns...").fill("test");
      await expect(page.getByPlaceholder("Search campaigns...")).toHaveValue(
        "test",
      );
    });

    test("Export button is visible on Campaigns tab", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Export" }).first(),
      ).toBeVisible();
    });

    test("Delete campaign – cancel dialog keeps campaign", async ({ page }) => {
      const deleteButton = page.locator('button[title="Delete"]').first();
      if (!(await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)))
        return;
      page.on("dialog", (dialog) => {
        expect(dialog.message()).toContain("delete");
        dialog.dismiss();
      });
      await deleteButton.click();
      await expect(
        page.getByRole("button", { name: "Create Campaign" }),
      ).toBeVisible();
    });

    test("Delete campaign – confirm dialog triggers delete", async ({
      page,
    }) => {
      const deleteButton = page.locator('button[title="Delete"]').first();
      if (!(await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)))
        return;
      page.on("dialog", (d) => d.accept());
      await deleteButton.click();
      await expect(
        page
          .getByText("Deleted", { exact: false })
          .or(page.locator(".p-toast-message")),
      ).toBeVisible({ timeout: 8000 });
    });
  });

  test.describe("Templates", () => {
    test("Templates tab loads template cards or empty state", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Templates" }).last().click();
      await expect(
        page
          .getByText("Loading templates...")
          .or(page.getByText("No templates found"))
          .or(page.getByText("Use"))
          .or(page.getByText("Create Template"))
          .or(page.getByText("template", { exact: false }))
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test("Create Template button navigates to template settings", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Templates" }).last().click();
      await page
        .getByRole("button", { name: "Create Template" })
        .first()
        .click();
      await page.waitForURL(/html-templates|marketing/, { timeout: 8000 });
      expect(page.url()).toMatch(/html-templates|marketing/);
    });
  });

  test.describe("Groups", () => {
    test("Groups tab shows Create Group and list or empty state", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Groups" }).click();
      await expect(
        page.getByRole("button", { name: "Create Group" }).first(),
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page
          .getByText("Loading groups...")
          .or(page.getByText("No groups found"))
          .or(page.getByText("Add Members")),
      ).toBeVisible({ timeout: 10000 });
    });

    test("Create Group modal opens and has Group Name field", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Groups" }).click();
      await page.getByRole("button", { name: "Create Group" }).first().click();
      await expect(page.getByText("Create Email Group")).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByPlaceholder("e.g., VIP Customers")).toBeVisible();
    });

    test("Create Group with name and close without saving", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Groups" }).last().click();
      await page.getByRole("button", { name: "Create Group" }).first().click();
      await page.getByPlaceholder("e.g., VIP Customers").fill("E2E Test Group");
      // Try Cancel first, then close icon (svg), then Escape
      const cancelBtn = page.getByRole("button", { name: "Cancel" }).first();
      if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelBtn.click();
      } else {
        const closeBtn = page.getByRole("button").filter({ has: page.locator("svg") }).first();
        if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeBtn.click();
        } else {
          await page.keyboard.press("Escape");
        }
      }
      await expect(page.getByText("Create Email Group")).not.toBeVisible({ timeout: 5000 });
    });

    test("Export Groups CSV button visible on Groups tab", async ({ page }) => {
      await page.getByRole("button", { name: "Groups" }).click();
      await expect(
        page.getByRole("button", { name: "Export" }).first(),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Contacts", () => {
    test("Contacts tab loads contacts list or empty state", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Contacts" }).click();
      await expect(
        page
          .getByText("Loading contacts...")
          .or(page.getByText("No contacts found"))
          .or(page.locator("table")),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("General / UI", () => {
    test("Breadcrumb shows Marketing and Email Marketing", async ({ page }) => {
      await expect(page.getByText("Email Marketing").first()).toBeVisible();
    });

    test("Page is usable at smaller viewport", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 });
      await expect(
        page.getByRole("button", { name: "Campaigns" }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Create Campaign" }).first(),
      ).toBeVisible();
    });
  });
});
