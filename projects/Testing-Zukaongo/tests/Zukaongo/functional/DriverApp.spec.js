import { test, expect } from "../../fixtures/zukaTest.js";
import { signIn } from "../../helpers/zukaAuth.js";
import { STEP_TIMEOUT } from "../../helpers/zukaEnv.js";
import { goOnline, goOffline } from "../../helpers/zukaPartner.js";

/** Partner app (drivers.zukaongo.com) as a driver — doc §3.3 and §4.3. */
test.describe("ZUKAongo — driver partner app", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "driver2");
    // DR-01: an online driver near a restaurant gets a dispatch offer dialog.
    // Here we only check the screens, so record the offer and decline it (DR-02 passes it on).
    const offer = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Decline" }) });
    await page.addLocatorHandler(offer, async () => {
      test.info().annotations.push({ type: "dispatch-offer", description: "Offer dialog received while online (declined)" });
      await offer.getByRole("button", { name: "Decline" }).click().catch(() => {});
    });
  });

  test("deliveries screen, filters and online toggle", async ({ page, soft }) => {
    await soft("ZUKA-DRV-01", "Deliveries shows the driver, location status and Open route", async () => {
      await expect(page.getByText("test-driver-2@zuka.test").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Go online|Go offline/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Open route/ })).toBeVisible();
    });
    await soft("ZUKA-DRV-02", "Filters All / Ready / Out for delivery / Delivered all render", async () => {
      for (const f of ["Ready", "Out for delivery", "Delivered", "All"]) {
        await page.getByRole("button", { name: f, exact: true }).click();
        await page.waitForTimeout(700);
        await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
      }
    });
    await soft("ZUKA-DRV-03", "Go online → 'Online — nearby delivery offers will pop up here'", async () => {
      await goOnline(page);
      await expect(page.getByText(/Online — nearby delivery offers/)).toBeVisible();
    });
    await soft("ZUKA-DRV-04", "Go offline → offline banner returns", async () => {
      await goOffline(page);
      await expect(page.getByText(/Offline — go online to get delivery offers/)).toBeVisible();
    });
  });

  test("settings: earnings and Cayman PayPal payouts", async ({ page, soft }) => {
    await soft("ZUKA-DRV-05", "Settings shows earnings: balance, tips, base pay, paid out", async () => {
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("heading", { name: "Partner settings" })).toBeVisible({ timeout: STEP_TIMEOUT });
      for (const t of ["Balance to be paid out", "Tips", "Base pay", "Paid out"]) {
        await expect(page.getByText(t).first()).toBeVisible();
      }
    });
    await soft("ZUKA-DRV-06", "Cayman drivers are paid by PayPal in US$ at CI$1 = US$1.20", async () => {
      await expect(page.getByText(/Stripe isn't available in the Cayman Islands/)).toBeVisible();
      await expect(page.getByText(/CI\$1 = US\$1\.20/)).toBeVisible();
    });
    await soft("ZUKA-DRV-07", "Save PayPal email stays disabled for an invalid email", async () => {
      const box = page.getByRole("textbox", { name: "PayPal email" });
      await box.fill("not-an-email");
      await expect(page.getByRole("button", { name: /Save PayPal email/ })).toBeDisabled();
      await box.fill("");
    });
    await soft("ZUKA-DRV-08", "Legal links and Back to deliveries", async () => {
      for (const l of [/Privacy policy/, /Terms of use/, /Contact support/]) {
        await expect(page.getByRole("link", { name: l })).toBeVisible();
      }
      await page.getByRole("button", { name: "Back to deliveries" }).click();
      await expect(page.getByRole("heading", { name: "Deliveries", level: 1 })).toBeVisible();
    });
  });
});
