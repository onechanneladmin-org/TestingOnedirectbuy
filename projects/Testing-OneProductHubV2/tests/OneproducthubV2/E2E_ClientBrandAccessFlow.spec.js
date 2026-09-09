import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  signInAsBrand,
  signInAsClient,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — E2E client brand access flow", () => {
  test("client brand directory and brand client access hub are reachable together", async ({
    browser,
    soft,
  }) => {
    const clientContext = await browser.newContext();
    const brandContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    const brandPage = await brandContext.newPage();

    try {
      await soft("OPH-E2E-CLIENT-DIRECTORY", "Client opens brand directory", async () => {
        await signInAsClient(clientPage);
        await clickSidebarNav(clientPage, "Brand Directory");
        await expect(
          clientPage.getByRole("heading", { name: "Brand Directory" })
        ).toBeVisible({ timeout: STEP_TIMEOUT });

        const requestBtn = clientPage.getByRole("button", {
          name: /Request access|Request|Edit draft/i,
        });
        if ((await requestBtn.count()) > 0) {
          await expect(requestBtn.first()).toBeVisible();
        }
      });

      await soft("OPH-E2E-BRAND-CLIENT-ACCESS", "Brand opens client access hub", async () => {
        await signInAsBrand(brandPage);
        await clickSidebarNav(brandPage, "Client Access");
        await expect(
          brandPage.getByRole("heading", { name: /Client Access/i })
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        await expect(
          brandPage.getByText(/pending|approved|revoked|request|access/i).first()
        ).toBeVisible({ timeout: STEP_TIMEOUT });
      });
    } finally {
      await clientContext.close();
      await brandContext.close();
    }
  });
});
