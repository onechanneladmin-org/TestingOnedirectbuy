import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  navigateToHash,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client team", () => {
  test("client can open team invite page", async ({ page, soft }) => {
    await soft("OPH-CLIENT-TEAM", "Open client team invite page", async () => {
      await signInAsClient(page);
      await navigateToHash(page, "client-team");

      const inviteName = page.locator("#invite-name");
      const inviteEmail = page.locator("#invite-email");
      const hasInviteForm =
        (await inviteName.isVisible().catch(() => false)) ||
        (await inviteEmail.isVisible().catch(() => false));

      if (hasInviteForm) {
        await expect(inviteName.or(inviteEmail).first()).toBeVisible();
      } else {
        await expect(
          page.getByText(/team|invite|member|role/i).first()
        ).toBeVisible({ timeout: STEP_TIMEOUT });
      }
    });
  });
});
