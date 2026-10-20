import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client settings", () => {
  test("client settings shows profile sections and hides brand-only nav", async ({
    page,
    soft,
  }) => {
    await soft("OPH-CLIENT-SETTINGS", "Open client settings without brand-only nav", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Settings");

      await expect(
        page.getByText(/Settings|Profile|Account|Security/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      await expect(
        page.getByText(/product feeds|feed export|api keys|brand registry/i)
      ).toHaveCount(0);
    });
  });
});
