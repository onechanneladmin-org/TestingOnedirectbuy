import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  navigateToHash,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client access drafts", () => {
  test("client can open access drafts page", async ({ page, soft }) => {
    await soft("OPH-CLIENT-ACCESS-DRAFTS", "Open client access drafts", async () => {
      await signInAsClient(page);
      await navigateToHash(page, "client-access-drafts");

      await expect(
        page.getByText(/draft|access|request|brand/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
