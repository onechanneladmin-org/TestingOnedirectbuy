import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client brand directory", () => {
  test("client can browse the brand directory", async ({ page, soft }) => {
    await soft("OPH-CLIENT-BRAND-DIRECTORY", "Browse client brand directory", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Brand Directory");

      await expect(
        page.getByRole("heading", { name: "Brand Directory" })
      ).toBeVisible();
      await expect(page.getByPlaceholder(/search/i).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
    });
  });
});
