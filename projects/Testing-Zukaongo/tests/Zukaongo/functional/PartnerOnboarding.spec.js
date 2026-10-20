import { test, expect } from "../../fixtures/zukaTest.js";
import { signIn } from "../../helpers/zukaAuth.js";
import { CUSTOMER_URL, ADMIN_URL, ALLOW_PARTNER_SUBMIT, STEP_TIMEOUT } from "../../helpers/zukaEnv.js";

/** Doc §4: partner applications (zukaongo.com/partner) and admin review. */

async function openPartner(page, type = "") {
  await page.goto(`${CUSTOMER_URL}/partner${type ? `?type=${type}` : ""}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Become a ZUKAongo partner", level: 1 })).toBeVisible();
}

const restaurantChoice = (page) => page.getByRole("button", { name: /^List my restaurant/ });
const driverChoice = (page) => page.getByRole("button", { name: /^Deliver with ZUKAongo/ });

async function fillRestaurant(page, overrides = {}) {
  const v = {
    restaurant: "QA Automation Kitchen",
    cuisine: "Caribbean",
    address: "18 Forum Lane, Camana Bay",
    name: "QA Automation",
    phone: "+1 345 555 0100",
    email: `qa-restaurant-${Date.now()}@zuka.test`,
    area: "Camana Bay",
    ...overrides,
  };
  await page.getByRole("textbox", { name: "Restaurant name" }).fill(v.restaurant);
  await page.getByRole("textbox", { name: "Cuisine (optional)" }).fill(v.cuisine);
  await page.getByRole("textbox", { name: "Restaurant address" }).fill(v.address);
  await page.getByRole("textbox", { name: "Your name" }).fill(v.name);
  await page.getByRole("textbox", { name: "Phone" }).fill(v.phone);
  await page.getByRole("textbox", { name: "Email" }).fill(v.email);
  await page.getByRole("textbox", { name: "Restaurant area" }).fill(v.area);
  return v;
}

/** The form reports errors in a role=status line and creates no "par-…" reference. */
async function expectRejected(page, message) {
  await page.getByRole("button", { name: "Apply to list my restaurant" }).click();
  const status = page.getByRole("status");
  await expect(status).toBeVisible({ timeout: STEP_TIMEOUT });
  if (message) await expect(status).toContainText(message);
  await expect(page.getByText(/par-[a-z0-9]/i)).toHaveCount(0);
}

test.describe("ZUKAongo — partner onboarding", () => {
  test("partner page offers restaurant and driver paths", async ({ page, soft }) => {
    await openPartner(page);
    await soft("ZUKA-PA-01", "Restaurant path is selected by default with its fields", async () => {
      await expect(restaurantChoice(page)).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("heading", { name: "How it works for restaurants" })).toBeVisible();
      for (const f of ["Restaurant name", "Cuisine (optional)", "Restaurant address", "Your name", "Phone", "Email", "Restaurant area"]) {
        await expect(page.getByRole("textbox", { name: f })).toBeVisible();
      }
      await expect(page.getByRole("button", { name: "Apply to list my restaurant" })).toBeVisible();
    });
    await soft("ZUKA-PA-02", "Switching to driver shows the vehicle choice and hides restaurant fields", async () => {
      await driverChoice(page).click();
      await expect(driverChoice(page)).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("heading", { name: "How it works for drivers" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Restaurant name" })).toHaveCount(0);
      const vehicle = page.getByRole("combobox", { name: "Vehicle" });
      await expect(vehicle.locator("option")).toHaveText(["Car", "Scooter / motorbike", "Bicycle"]);
      await vehicle.selectOption({ label: "Bicycle" });
      await expect(vehicle).toHaveValue(/bicycle/i);
    });
    await soft("ZUKA-PA-03", "?type=driver preselects the driver path", async () => {
      await openPartner(page, "driver");
      await expect(driverChoice(page)).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("button", { name: "Apply to deliver" })).toBeVisible();
    });
    await soft("ZUKA-PA-04", "Privacy policy link is shown under the form", async () => {
      await expect(page.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");
    });
  });

  test("PA-02: invalid restaurant applications are refused with a field error", async ({ page, soft }) => {
    await soft("ZUKA-PA-05", "Empty form → 'Enter your name'-style error, nothing saved", async () => {
      await openPartner(page);
      await expectRejected(page);
    });
    await soft("ZUKA-PA-06", "Restaurant without an address is refused", async () => {
      await openPartner(page);
      await fillRestaurant(page, { address: "" });
      await expectRejected(page, /address/i);
    });
    await soft("ZUKA-PA-07", "Bad email is refused", async () => {
      await openPartner(page);
      await fillRestaurant(page, { email: "not-an-email" });
      await expectRejected(page, /email/i);
    });
    await soft("ZUKA-PA-08", "Phone with fewer than 7 digits is refused", async () => {
      await openPartner(page);
      await fillRestaurant(page, { phone: "12345" });
      await expectRejected(page, /phone/i);
    });
  });

  test("PA-02: driver application without a name is refused", async ({ page, soft }) => {
    await soft("ZUKA-PA-09", "Apply to deliver with an empty form → 'Enter your name'", async () => {
      await openPartner(page, "driver");
      await page.getByRole("button", { name: "Apply to deliver" }).click();
      await expect(page.getByRole("status")).toContainText("Enter your name");
    });
  });

  test("PA-01 / PA-03: restaurant application succeeds once, then is deduplicated", async ({ page, soft }) => {
    test.skip(!ALLOW_PARTNER_SUBMIT, "ZUKA_ALLOW_PARTNER_SUBMIT=0 — submitting emails the support inbox");
    await openPartner(page);
    const values = await fillRestaurant(page);
    await soft("ZUKA-PA-10", "Valid application shows a par-… reference", async () => {
      await page.getByRole("button", { name: "Apply to list my restaurant" }).click();
      await expect(page.getByText(/par-[a-z0-9]+/i)).toBeVisible({ timeout: STEP_TIMEOUT });
    });
    await soft("ZUKA-PA-11", "Same email again → 'We already have your application'", async () => {
      await openPartner(page);
      await fillRestaurant(page, { email: values.email });
      await page.getByRole("button", { name: "Apply to list my restaurant" }).click();
      await expect(page.getByText(/already have your application/i)).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });

  test("admin Partners review screen lists New / Approved / Rejected", async ({ page, soft }) => {
    await signIn(page, "admin");
    await soft("ZUKA-PA-12", "Partners page explains approval and shows the three tabs", async () => {
      await page.goto(`${ADMIN_URL}/partners`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Partners" }).first()).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText(/restaurants start paused until you set them live/)).toBeVisible();
      for (const tab of [/^New/, /^Approved/, /^Rejected/]) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
      }
    });
    await soft("ZUKA-PA-13", "Each review tab opens without errors", async () => {
      for (const tab of [/^Approved/, /^Rejected/, /^New/]) {
        await page.getByRole("tab", { name: tab }).click();
        await page.waitForTimeout(800);
        await expect(page.getByText(/something went wrong|failed to load/i)).toHaveCount(0);
      }
    });
  });
});
