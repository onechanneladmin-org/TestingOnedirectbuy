import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  ONE_PRODUCT_HUB_V2_BASE_URL,
  openLoginForRole,
  signInAsClient,
} from "../helpers/oneProductHubV2Auth.js";
import { expectPublicHome, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — auth edge cases", () => {
  test("empty brand credentials stay on login", async ({ page, soft }) => {
    await soft("OPH-LOGIN-EMPTY-1", "Empty credentials stay on brand login", async () => {
      await openLoginForRole(page, "Brand");
      await page.getByRole("button", { name: "Sign In" }).click();
      await expect(page.getByRole("heading", { name: "Brand Login" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Email Address" })).toBeVisible();
    });
  });

  test("client session survives a full page reload", async ({ page, soft }) => {
    await soft("OPH-SESSION-PERSIST-CLIENT-1", "Client session survives full page reload", async () => {
      await signInAsClient(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: /Welcome back,/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
    });
  });

  test("guest settings and import hashes stay on public home", async ({ page, soft }) => {
    await soft("OPH-UNAUTH-GUARD-SETTINGS-1", "Settings hash shows public home for guests", async () => {
      await page.goto(`${ONE_PRODUCT_HUB_V2_BASE_URL}#/settings`);
      await expectPublicHome(page);
    });

    await soft("OPH-UNAUTH-GUARD-IMPORT-1", "Import hash shows public home for guests", async () => {
      await page.goto(`${ONE_PRODUCT_HUB_V2_BASE_URL}#/import`);
      await expectPublicHome(page);
    });
  });
});
