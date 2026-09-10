import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

const SETTINGS_SECTIONS = [
  "Profile",
  "General",
  "Notifications",
  "Email",
  "Security",
  "Branding",
  "Categories",
  "Account",
];

test.describe("One Product Hub V2 — brand settings and subscription actions", () => {
  test("brand can open settings sections and keep save profile visible", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-SETTINGS-SECTIONS-1", "Walk brand settings sections", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Settings");
      await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });

      for (const section of SETTINGS_SECTIONS) {
        const btn = page.getByRole("button", { name: new RegExp(`^${section}$`, "i") });
        if ((await btn.count()) === 0) continue;
        await btn.first().click();
        await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();
      }
      await expect(page.getByRole("button", { name: /Save profile/i })).toBeVisible();
      await capturePageOrModal(page, "Brand settings sections");
    });
  });

  test("brand can open Choose Plan without completing checkout", async ({ page, soft }) => {
    await soft("OPH-BRAND-CHOOSE-PLAN-1", "Brand Choose Plan CTA is visible", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Subscription");
      await expect(page.getByRole("heading", { name: /Choose Your Plan|Subscription/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(page.getByRole("heading", { name: /Launch|Accelerate|Turbo|Mach/i }).first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Choose Plan|Contact Sales|Active plan/i }).first(),
      ).toBeVisible();
      await capturePageOrModal(page, "Brand choose plan");
    });
  });
});
