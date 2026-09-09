import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { ONE_PRODUCT_HUB_V2_BASE_URL } from "../helpers/oneProductHubV2Auth.js";

test.describe("One Product Hub V2 — role selection", () => {
  test("login shows brand and client portal choices", async ({ page, soft }) => {
    await soft(
      "OPH-ROLE-SELECTION-1",
      "Login shows brand and client portal choices",
      async () => {
        await page.goto(ONE_PRODUCT_HUB_V2_BASE_URL);
        await page.getByRole("button", { name: "Login" }).click();
        await capturePageOrModal(page, "Role selection page");

        await expect(
          page.getByRole("heading", { name: "Welcome to ProductHub" })
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Continue as Brand" })
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Continue as Client" })
        ).toBeVisible();
      }
    );
  });
});
