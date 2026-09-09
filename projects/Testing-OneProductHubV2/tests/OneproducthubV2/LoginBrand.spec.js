import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";

test.describe("One Product Hub V2 — brand authentication", () => {
  test("brand user can sign in and reach the workspace dashboard", async ({
    page,
    soft,
  }) => {
    await soft("OPH-LOGIN-BRAND-1", "Brand sign-in reaches Workspace Overview", async () => {
      await signInAsBrand(page);
      await expect(
        page.getByRole("heading", { name: "Workspace Overview" })
      ).toBeVisible();
      await expect(page.getByText(/anuragsinghg999@gmail.com/i).first()).toBeVisible();
    });
  });
});
