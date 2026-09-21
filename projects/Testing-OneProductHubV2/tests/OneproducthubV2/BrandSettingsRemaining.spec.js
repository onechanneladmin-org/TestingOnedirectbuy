import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  openSettingsSection,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

const REMAINING_SECTIONS = [
  "Brand registry",
  "Product feeds",
  "Feed & export",
  "Data & export",
  "API & integrations",
  "Audit",
  "Request form",
];

test.describe("One Product Hub V2 — remaining brand settings and subscription", () => {
  test("brand can open remaining settings tabs", async ({ page, soft }) => {
    await soft("OPH-BRAND-SETTINGS-REMAINING-1", "Walk remaining brand settings tabs", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Settings");
      await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });

      for (const section of REMAINING_SECTIONS) {
        await openSettingsSection(page, section);
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
      }
      await capturePageOrModal(page, "Brand remaining settings");
    });

    await soft("OPH-BRAND-ACCESS-SEARCH-1", "Search client access hub", async () => {
      await clickSidebarNav(page, "Client Access");
      const search = page.getByPlaceholder(/Search by name, email, or company/i);
      await expect(search).toBeVisible({ timeout: STEP_TIMEOUT });
      await search.fill("a");
      await expect(page.getByRole("heading", { name: /Client Access/i })).toBeVisible();
    });
  });

  test("brand subscription show more and clear local plan stay on page", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-SUB-SHOW-MORE-1", "Expand subscription feature lists", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Subscription");
      await expect(page.getByRole("heading", { name: /Choose Your Plan/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      const showMore = page.getByRole("button", { name: /Show \d+ more/i }).first();
      await expect(showMore).toBeVisible({ timeout: STEP_TIMEOUT });
      await showMore.click();
      await capturePageOrModal(page, "Subscription show more");
    });

    await soft("OPH-BRAND-SUB-CLEAR-PLAN-1", "Clear local plan without checkout", async () => {
      await page.getByRole("button", { name: /Clear local plan/i }).click();
      await expect(page.getByRole("heading", { name: /Choose Your Plan/i })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Choose Plan|Contact Sales|Active plan/i }).first(),
      ).toBeVisible();
    });
  });
});
