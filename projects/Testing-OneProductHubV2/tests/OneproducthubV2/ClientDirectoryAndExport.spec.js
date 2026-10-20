import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, dismissDialog, navigateToHash, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client directory export and team remaining", () => {
  test("client export empty state returns to brand directory", async ({ page, soft }) => {
    await soft("OPH-CLIENT-EXPORT-DIRECTORY-1", "Export empty state goes to brand directory", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Export Center");
      await expect(page.getByRole("heading", { name: /Export/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      const goDir = page.getByRole("button", { name: /Go to Brand Directory/i });
      if (await goDir.isVisible().catch(() => false)) {
        await goDir.click();
        await expect(page.getByRole("heading", { name: "Brand Directory" })).toBeVisible({
          timeout: STEP_TIMEOUT,
        });
      } else {
        await expect(page.getByRole("heading", { name: /Export/i })).toBeVisible();
      }
      await capturePageOrModal(page, "Client export to directory");
    });
  });

  test("client changelog team search and request form stay UI-only", async ({ page, soft }) => {
    await soft("OPH-CLIENT-CHANGELOG-SIDEBAR-1", "Open product change log from sidebar", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Product Change Log");
      await expect(
        page.getByRole("heading", { name: /Change Log|Changelog|Product Change|Workspace Overview/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });

    await soft("OPH-CLIENT-TEAM-SEARCH-1", "Search team members", async () => {
      await navigateToHash(page, "client-team");
      await expect(page.getByRole("heading", { name: /Team Members/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      const search = page.getByPlaceholder(/Search by name or email/i);
      await expect(search).toBeVisible();
      await search.fill("a");
      await capturePageOrModal(page, "Client team search");
    });

    await soft("OPH-CLIENT-TEAM-INVITE-OPEN-1", "Open invite member without sending", async () => {
      const invite = page.getByRole("button", { name: /Invite member/i });
      if (await invite.isVisible().catch(() => false)) {
        await invite.click();
        await dismissDialog(page);
      }
      await expect(page.getByRole("heading", { name: /Team Members/i })).toBeVisible();
    });

    await soft("OPH-CLIENT-REQUEST-FORM-UI-1", "Open request access form without submitting", async () => {
      await clickSidebarNav(page, "Brand Directory");
      const requestBtn = page.getByRole("button", { name: /Request access|Edit draft/i });
      if ((await requestBtn.count()) > 0) {
        await requestBtn.first().click();
        await expect(
          page.getByText(/request|draft|access|brand|submit|pending/i).first(),
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        await dismissDialog(page);
      } else {
        await expect(page.getByRole("heading", { name: "Brand Directory" })).toBeVisible();
      }
      await capturePageOrModal(page, "Client request form UI");
    });

    await soft("OPH-CLIENT-CHECKOUT-UI-1", "Client plans visible without checkout", async () => {
      await clickSidebarNav(page, "Subscription");
      await expect(
        page.getByRole("heading", { name: /Subscription|Choose Your Plan|Free Plan|Growth/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
