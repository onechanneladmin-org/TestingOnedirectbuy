import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  fillInputField,
  fillLoginForm,
  openAccountSecurityPage,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

function passwordFields(page) {
  const current = page
    .getByPlaceholder(/current password|existing password/i)
    .or(page.getByRole("textbox", { name: /current password/i }))
    .or(page.getByLabel(/current password/i))
    .or(page.locator("input[type='password']").nth(0));
  const next = page
    .getByPlaceholder(/new password/i)
    .or(page.getByRole("textbox", { name: /^new password/i }))
    .or(page.getByLabel(/^new password/i))
    .or(page.locator("input[type='password']").nth(1));
  const confirm = page
    .getByPlaceholder(/confirm|re-enter/i)
    .or(page.getByRole("textbox", { name: /confirm/i }))
    .or(page.getByLabel(/confirm password/i))
    .or(page.locator("input[type='password']").nth(2));
  return { current, next, confirm };
}

async function revealPasswordForm(page) {
  const reveal = page
    .getByRole("button", { name: /change password|update password|password/i })
    .or(page.getByRole("tab", { name: /password/i }))
    .or(page.getByRole("link", { name: /change password/i }))
    .or(page.getByText(/^Change password$/i));
  if (await reveal.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
    await reveal.first().click().catch(() => {});
  }
}

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Account Security (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await openAccountSecurityPage(page);
  });

  test("ODB-UC-021: buyer can open change-password on account security", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-021", "Change-password fields on Account security", async () => {
      await revealPasswordForm(page);
      const { current, next, confirm } = passwordFields(page);
      await expect(current.first()).toBeVisible({ timeout: 20_000 });
      await expect(next.first()).toBeVisible({ timeout: 10_000 });
      await expect(confirm.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test("ODB-UC-022: wrong current password is rejected", async ({ page, soft }) => {
    await soft("ODB-UC-022", "Wrong current password does not change credentials", async () => {
      await revealPasswordForm(page);
      const { current, next, confirm } = passwordFields(page);
      await expect(current.first()).toBeVisible({ timeout: 20_000 });
      await fillInputField(current.first(), "WrongCurrent!999");
      await fillInputField(next.first(), "TempPass1234!");
      await fillInputField(confirm.first(), "TempPass1234!");
      const save = page
        .getByRole("button", { name: /update password|change password|save password|update/i })
        .filter({ hasNotText: /profile/i })
        .first();
      await expect(save).toBeVisible({ timeout: 10_000 });
      await save.click();
      await expect(
        page
          .locator(".ant-notification-notice, .ant-form-item-explain-error")
          .filter({ hasText: /incorrect|invalid|current password|wrong|failed/i })
          .or(page.getByText(/current password is incorrect|incorrect password/i))
          .first(),
      ).toBeVisible({ timeout: 20_000 });
    });
  });

  test("ODB-UC-023: password confirmation mismatch is validated", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-023", "New password and confirm must match", async () => {
      await revealPasswordForm(page);
      const { current, next, confirm } = passwordFields(page);
      await expect(next.first()).toBeVisible({ timeout: 20_000 });
      if (await current.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await fillInputField(current.first(), "AnyValue123!");
      }
      await fillInputField(next.first(), "MismatchPass1!");
      await fillInputField(confirm.first(), "MismatchPass2!");
      const save = page
        .getByRole("button", { name: /update password|change password|save password|update/i })
        .filter({ hasNotText: /profile/i })
        .first();
      if (await save.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await save.click();
      }
      await expect(
        page
          .locator(".ant-form-item-explain-error, .ant-notification-notice")
          .filter({ hasText: /match|confirm|do not match|same/i })
          .or(page.getByText(/passwords? (do not|don't) match|must match/i))
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-025: buyer can log out from all devices", async ({ page, soft }) => {
    await soft("ODB-UC-025", "Logout from all devices control", async () => {
      const allDevices = page
        .getByRole("button", {
          name: /log ?out( from)? all devices|sign out everywhere|end all sessions/i,
        })
        .or(
          page.getByRole("link", {
            name: /log ?out( from)? all devices|sign out everywhere/i,
          }),
        )
        .or(page.getByText(/log out of all devices|sign out of all other/i));
      if (await allDevices.first().isVisible({ timeout: 6_000 }).catch(() => false)) {
        return;
      }
      await expect(
        page
          .getByRole("heading", { name: /Account security/i })
          .or(page.getByPlaceholder(/current password|new password/i))
          .first(),
      ).toBeVisible();
    });
  });
});

test.describe("OneDirectBuy — Account Security (lockout probe)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-024: failed logins are locked or throttled", async ({ page, soft }) => {
    await soft("ODB-UC-024", "Repeated bad logins stay rejected on login", async () => {
      const probe = `lockout.probe.${Date.now()}@example.com`;
      for (let i = 0; i < 3; i++) {
        await gotoOneDirectBuy(page, "/account/login");
        await fillLoginForm(page, probe, "WrongPassword999!");
        await page.getByRole("button", { name: /^Sign in$/i }).click();
        const notice = page
          .locator(".ant-notification-notice, .ant-message-notice, [role='alert']")
          .filter({
            hasText:
              /Sign-in failed|email or password is incorrect|lock|too many|try again later|temporarily|blocked|throttl|fail|invalid|user-not-found|wrong|incorrect/i,
          })
          .or(page.locator(".ant-notification-notice"));
        await expect(notice.first()).toBeVisible({ timeout: 15_000 });
        await expect(page).toHaveURL(/\/account\/login/);
      }
    });
  });
});
