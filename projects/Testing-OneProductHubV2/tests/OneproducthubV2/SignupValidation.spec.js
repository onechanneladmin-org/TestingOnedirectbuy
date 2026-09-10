import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { openLoginForRole } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — signup validation", () => {
  test("brand signup stays disabled until terms are accepted", async ({ page, soft }) => {
    await soft("OPH-SIGNUP-BRAND-TERMS-1", "Brand Create Account disabled without terms", async () => {
      await openLoginForRole(page, "Brand");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(
        page.getByRole("heading", { name: /Create Brand Account/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      const submit = page.getByRole("button", { name: /^Create Account$/i });
      await expect(submit).toBeDisabled();
      await capturePageOrModal(page, "Brand signup terms gate");
    });
  });

  test("brand signup exposes business identity fields and brand/client toggle", async ({
    page,
    soft,
  }) => {
    await soft("OPH-SIGNUP-BRAND-FIELDS-1", "Brand signup required identity fields", async () => {
      await openLoginForRole(page, "Brand");
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(page.getByRole("textbox", { name: /Full Name/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /Email Address/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /Brand\/Company Name/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /Business Registration Number/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /Federal Tax ID/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /Authorized Signatory Email/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Brand$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Client$/i })).toBeVisible();
    });
  });

  test("client signup lists business types and B2B submit stays disabled without terms", async ({
    page,
    soft,
  }) => {
    await soft("OPH-SIGNUP-CLIENT-B2B-1", "Client signup business type and terms gate", async () => {
      await openLoginForRole(page, "Client");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(
        page.getByRole("heading", { name: /Create Client Account/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      await expect(
        page.getByRole("button", { name: /Submit B2B Registration for Verification/i }),
      ).toBeDisabled();

      await page.getByRole("combobox", { name: /Select business type/i }).click();
      await expect(page.getByRole("option", { name: "Retailer" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Wholesaler" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Distributor" })).toBeVisible();
      await expect(page.getByRole("option", { name: "E-commerce" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Marketplace" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Other" })).toBeVisible();
      await capturePageOrModal(page, "Client signup business types");
    });
  });
});
