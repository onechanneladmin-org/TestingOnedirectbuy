import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import { signOut } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — sign out", () => {
  test("client can sign out and return to the public home page", async ({
    page,
    soft,
  }) => {
    await soft("OPH-LOGOUT-1", "Client sign-out returns to public home", async () => {
      await signInAsClient(page);
      await signOut(page);
      await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    });
  });
});
