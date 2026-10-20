import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client export", () => {
  test("client can open the export center", async ({ page, soft }) => {
    await soft("OPH-CLIENT-EXPORT", "Open client export center", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Export Center");

      await expect(
        page.getByRole("heading", { name: /Export/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
