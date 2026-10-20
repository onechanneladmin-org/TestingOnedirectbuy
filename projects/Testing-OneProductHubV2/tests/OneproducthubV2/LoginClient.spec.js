import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";

test.describe("One Product Hub V2 — client authentication", () => {
  test("client user can sign in and reach the dashboard", async ({
    page,
    soft,
  }) => {
    await soft("OPH-LOGIN-CLIENT-1", "Client sign-in reaches dashboard", async () => {
      await signInAsClient(page);
      await expect(
        page.getByRole("heading", { name: /Welcome back,/i })
      ).toBeVisible();
      await expect(page.getByText(/anuragsinghg99@gmail.com/i).first()).toBeVisible();
    });
  });
});
