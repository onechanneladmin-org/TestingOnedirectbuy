import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  ensureLoggedInBuyer,
  logoutBuyer,
  hasBuyerCredentials,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
  gotoAuthenticatedPage,
  fillInputField,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Authenticated Buyer Account", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-005: login with valid credentials reaches account dashboard", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-005-auth", "my-account shows dashboard + Logout", async () => {
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(
        page.getByText(/account dashboard|Hello|recent orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/^Logout$/i)).toBeVisible();
    });
  });

  test("ODB-UC-009: buyer updates profile details then restores them", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-009", "Update name on account information and restore", async () => {
      await gotoAuthenticatedPage(
        page,
        "/account/user-information",
        ONE_DIRECT_BUY_BUYER_CREDENTIALS,
      );
      await expect(
        page.getByRole("heading", { name: /Account Information/i }).first(),
      ).toBeVisible({ timeout: 20_000 });

      const saveBtn = page.getByRole("button", { name: /update profile/i });

      async function waitForProfileForm() {
        await expect(saveBtn.first()).toBeVisible({ timeout: 30_000 });
        await expect(
          page.getByPlaceholder(/Enter last name/i).first(),
        ).toBeVisible({ timeout: 45_000 });
      }

      await waitForProfileForm();

      const nameInput = page
        .getByPlaceholder(/Enter last name/i)
        .first()
        .locator(
          "xpath=preceding::input[not(@type='hidden') and not(@type='password') and not(@type='search')][1]",
        );
      const lastNameInput = page.getByPlaceholder(/Enter last name/i).first();
      await expect(nameInput).toBeVisible({ timeout: 15_000 });

      const original = (await nameInput.inputValue()) || "Oneauto";
      const lastOriginal = (await lastNameInput.inputValue()) || "";
      if (!lastOriginal.trim()) {
        await fillInputField(lastNameInput, "Tester");
      }
      const stamp = Date.now().toString().slice(-4);
      const updated = original.includes("ODBQA")
        ? original.replace(/\s*ODBQA\d+/, "").trim() || original
        : `${original} ODBQA${stamp}`.slice(0, 40);

      async function saveProfile() {
        const save = page.getByRole("button", { name: /update profile/i }).first();
        await expect(save).toBeVisible({ timeout: 10_000 });
        await save.click();
        const toast = page
          .locator(".ant-notification-notice, .ant-message-notice")
          .filter({ hasText: /success|updated|saved/i });
        const fieldError = page.locator(".ant-form-item-explain-error");
        await Promise.race([
          toast.first().waitFor({ state: "visible", timeout: 15_000 }),
          fieldError.first().waitFor({ state: "visible", timeout: 15_000 }),
        ]).catch(() => {});
        if (await fieldError.first().isVisible().catch(() => false)) {
          const texts = (await fieldError.allTextContents())
            .map((t) => t.trim())
            .filter(Boolean);
          throw new Error(
            `Update profile blocked by validation: ${texts.slice(0, 8).join("; ")}`,
          );
        }
        if (!(await toast.first().isVisible().catch(() => false))) {
          await waitForProfileForm();
        }
      }

      try {
        await fillInputField(nameInput, updated);
        await saveProfile();
        await gotoOneDirectBuy(page, "/account/user-information");
        await waitForProfileForm();
        await expect(nameInput).toHaveValue(updated, { timeout: 15_000 });
      } finally {
        await gotoAuthenticatedPage(
          page,
          "/account/user-information",
          ONE_DIRECT_BUY_BUYER_CREDENTIALS,
        );
        await waitForProfileForm();
        if (await nameInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
          await fillInputField(nameInput, original);
          await saveProfile();
        }
      }
    });
  });

  test("ODB-UC-014: buyer logs out successfully", async ({ page, soft }) => {
    await soft("ODB-UC-014", "Logout returns to Welcome back login", async () => {
      await logoutBuyer(page);
      await gotoOneDirectBuy(page, "/account/login");
      await expect(page.getByRole("heading", { name: /^Welcome back$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible();
    });
  });
});
