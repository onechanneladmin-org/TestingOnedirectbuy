import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { openRoleSelection } from "../helpers/oneProductHubV2Auth.js";

test.describe("One Product Hub V2 — role selection", () => {
  test("login shows brand and client portal choices", async ({ page, soft }) => {
    await soft(
      "OPH-ROLE-SELECTION-1",
      "Login shows brand and client portal choices",
      async () => {
        await openRoleSelection(page);
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
