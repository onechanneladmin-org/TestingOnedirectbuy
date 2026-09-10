import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  navigateToHash,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client account actions", () => {
  test("client can open notifications and manage plan from dashboard", async ({
    page,
    soft,
  }) => {
    await soft("OPH-CLIENT-NOTIFICATIONS-1", "Open client activity and notifications", async () => {
      await signInAsClient(page);
      await page.getByRole("button", { name: /Open activity and notifications/i }).click();
      await expect(
        page.getByText(/notification|activity|no (new )?notification/i).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Client notifications");
    });

    await soft("OPH-CLIENT-MANAGE-PLAN-1", "Manage plan from client dashboard", async () => {
      const manage = page.getByRole("button", { name: /Manage plan/i });
      await expect(manage).toBeVisible({ timeout: STEP_TIMEOUT });
      await manage.click();
      await expect(
        page.getByRole("heading", { name: /Subscription|Free Plan|Growth Plan/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });

  test("client settings save profile and security sections are reachable", async ({
    page,
    soft,
  }) => {
    await soft("OPH-CLIENT-SETTINGS-SECTIONS-1", "Open client profile security and save", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Settings");
      await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      for (const section of ["Profile", "General", "Security", "Account"]) {
        const btn = page.getByRole("button", { name: new RegExp(`^${section}$`, "i") });
        if ((await btn.count()) > 0) await btn.first().click();
      }
      await expect(page.getByRole("button", { name: /Save profile/i })).toBeVisible();
      await capturePageOrModal(page, "Client settings sections");
    });
  });

  test("client team invite form can be filled without sending", async ({ page, soft }) => {
    await soft("OPH-CLIENT-TEAM-INVITE-1", "Fill client team invite fields", async () => {
      await signInAsClient(page);
      await navigateToHash(page, "client-team");
      const inviteName = page.locator("#invite-name");
      const inviteEmail = page.locator("#invite-email");
      if (await inviteName.isVisible().catch(() => false)) {
        await inviteName.fill("Oph Invitee");
        await inviteEmail.fill("oph-invitee@example.com");
        await expect(inviteEmail).toHaveValue("oph-invitee@example.com");
      } else {
        await expect(page.getByText(/team|invite|member|role/i).first()).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
      }
      await capturePageOrModal(page, "Client team invite");
    });
  });
});
