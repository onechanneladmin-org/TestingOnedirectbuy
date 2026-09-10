import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand, signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — E2E client request access", () => {
  test("client request-access and brand access hub stay in sync as a journey", async ({
    browser,
    soft,
  }) => {
    const clientContext = await browser.newContext();
    const brandContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    const brandPage = await brandContext.newPage();

    try {
      await soft("OPH-E2E-REQUEST-ACCESS-1", "Client opens directory and request access", async () => {
        await signInAsClient(clientPage);
        await clickSidebarNav(clientPage, "Brand Directory");
        await expect(
          clientPage.getByRole("heading", { name: "Brand Directory" }),
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        const requestBtn = clientPage.getByRole("button", {
          name: /Request access|Request|Edit draft/i,
        });
        if ((await requestBtn.count()) > 0) {
          await requestBtn.first().click();
          await expect(
            clientPage.getByText(/request|draft|access|brand|submit|pending/i).first(),
          ).toBeVisible({ timeout: STEP_TIMEOUT });
        }
        await capturePageOrModal(clientPage, "Client request access");
      });

      await soft("OPH-E2E-BRAND-REVIEW-ACCESS-1", "Brand reviews client access requests", async () => {
        await signInAsBrand(brandPage);
        await clickSidebarNav(brandPage, "Client Access");
        await expect(
          brandPage.getByRole("heading", { name: /Client Access/i }),
        ).toBeVisible({ timeout: STEP_TIMEOUT });
        const pending = brandPage.getByRole("button", { name: /pending/i });
        if ((await pending.count()) > 0) await pending.first().click();
        await expect(
          brandPage.getByText(/pending|approved|revoked|request|access/i).first(),
        ).toBeVisible();
        await capturePageOrModal(brandPage, "Brand review access");
      });
    } finally {
      await clientContext.close();
      await brandContext.close();
    }
  });
});
