import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client product changelog", () => {
  test("client can open the product change log", async ({ page, soft }) => {
    await soft("OPH-CLIENT-CHANGELOG", "Open client product change log", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Product Change Log");

      await expect(
        page.getByRole("heading", { name: /Change Log|Changelog|Product Change/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
