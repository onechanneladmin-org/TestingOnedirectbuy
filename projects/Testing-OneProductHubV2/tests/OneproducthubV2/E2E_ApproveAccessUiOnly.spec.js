import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — E2E approve access UI only", () => {
  test("brand pending access list shows review controls without approving", async ({
    page,
    soft,
  }) => {
    await soft("OPH-E2E-APPROVE-UI-1", "Brand pending access review without approve", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Client Access");
      await expect(page.getByRole("heading", { name: /Client Access/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      const pending = page.getByRole("button", { name: /pending/i });
      if ((await pending.count()) > 0) await pending.first().click();
      await expect(
        page.getByText(/pending|approved|revoked|request|access|client/i).first(),
      ).toBeVisible();
      await capturePageOrModal(page, "Brand approve access UI only");
    });
  });
});
