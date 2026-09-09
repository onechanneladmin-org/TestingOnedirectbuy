import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand client access", () => {
  test("brand can open client access hub with request tabs", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-CLIENT-ACCESS", "Open client access hub", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Client Access");

      await expect(
        page.getByRole("heading", { name: /Client Access/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      await expect(
        page.getByText(/pending|approved|revoked|request|access/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
