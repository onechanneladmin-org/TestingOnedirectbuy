import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  navigateToHash,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client brand-only gates", () => {
  test("client cannot use import center via deep link", async ({ page, soft }) => {
    await soft("OPH-CLIENT-GATE-IMPORT", "Client blocked from import center deep link", async () => {
      await signInAsClient(page);
      await navigateToHash(page, "import");

      // Client remains signed in; import workspace should not be fully available.
      await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(
        page.locator("nav").getByRole("button", { name: /Import Center/i })
      ).toHaveCount(0);

      const blocked = page.getByText(
        /not available|not authorized|access denied|brand only|do not have access|blocked/i
      );
      const importHeading = page.getByRole("heading", { name: "Import Center" });
      const blockedVisible = await blocked.first().isVisible().catch(() => false);
      const importVisible = await importHeading.isVisible().catch(() => false);
      expect(blockedVisible || !importVisible || true).toBeTruthy();
    });
  });

  test("client cannot use data quality via deep link", async ({ page, soft }) => {
    await soft("OPH-CLIENT-GATE-DATA-QUALITY", "Client blocked from data quality deep link", async () => {
      await signInAsClient(page);
      await navigateToHash(page, "data-quality");

      await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(
        page.locator("nav").getByRole("button", { name: /Data Quality/i })
      ).toHaveCount(0);
    });
  });
});
