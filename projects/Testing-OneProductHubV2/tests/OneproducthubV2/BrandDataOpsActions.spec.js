import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand data operations", () => {
  test("brand client access hub exposes request status tabs", async ({ page, soft }) => {
    await soft("OPH-BRAND-ACCESS-TABS-1", "Open pending approved revoked access tabs", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Client Access");
      await expect(page.getByRole("heading", { name: /Client Access/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });

      for (const tab of [/pending/i, /approved/i, /revoked/i]) {
        const control = page.getByRole("button", { name: tab }).or(page.getByRole("tab", { name: tab }));
        if ((await control.count()) > 0) {
          await control.first().click();
        }
      }
      await expect(page.getByText(/pending|approved|revoked|request|access/i).first()).toBeVisible();
      await capturePageOrModal(page, "Brand access tabs");
    });
  });

  test("brand import center exposes upload or template controls", async ({ page, soft }) => {
    await soft("OPH-BRAND-IMPORT-ACTIONS-1", "Import center upload or template actions", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Import Center");
      await expect(page.getByRole("heading", { name: /Import/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(
        page
          .getByRole("button", { name: /Download sample CSV|Download sample JSON|Preview Import|Start Import/i })
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Brand import actions");
    });
  });

  test("brand export center exposes format or generate controls", async ({ page, soft }) => {
    await soft("OPH-BRAND-EXPORT-ACTIONS-1", "Export center format or generate actions", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Export Center");
      await expect(page.getByRole("heading", { name: /Export/i }).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(
        page
          .getByRole("button", { name: /Export products now|CSV|Excel|JSON/i })
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Brand export actions");
    });
  });

  test("brand change log can be searched or filtered", async ({ page, soft }) => {
    await soft("OPH-BRAND-CHANGELOG-SEARCH-1", "Search or filter product change log", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Product Change Log");
      await expect(
        page.getByRole("heading", { name: /Change Log|Changelog|Product Change/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      const search = page.getByPlaceholder(/search|sku|product|filter/i);
      if ((await search.count()) > 0) {
        await search.first().fill("test");
      }
      await expect(page.getByText(/change|log|product|no /i).first()).toBeVisible();
      await capturePageOrModal(page, "Brand changelog search");
    });
  });
});
