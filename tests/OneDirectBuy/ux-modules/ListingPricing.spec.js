import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Listing Pricing", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-027: normalizeB2bPricingInput sorts and dedupes tiers", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-027", "normalizeB2bPricingInput sorts and dedupes tiers", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-027",
        title: "normalizeB2bPricingInput sorts and dedupes tiers",
        file: "listingPricing.test.js",
        testName: "normalizeB2bPricingInput sorts and dedupes tiers",
        runner: "jest",
        slug: "listing-pricing",
      });
    });
  });

  test("ODB-UX-028: resolveB2bUnitPrice picks highest qualifying tier", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-028", "resolveB2bUnitPrice picks highest qualifying tier", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-028",
        title: "resolveB2bUnitPrice picks highest qualifying tier",
        file: "listingPricing.test.js",
        testName: "resolveB2bUnitPrice picks highest qualifying tier",
        runner: "jest",
        slug: "listing-pricing",
      });
    });
  });

  test("ODB-UX-029: getListingLineUnitPrice uses min(consumer, b2b)", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-029", "getListingLineUnitPrice uses min(consumer, b2b)", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-029",
        title: "getListingLineUnitPrice uses min(consumer, b2b)",
        file: "listingPricing.test.js",
        testName: "getListingLineUnitPrice uses min(consumer, b2b)",
        runner: "jest",
        slug: "listing-pricing",
      });
    });
  });

  test("ODB-UX-030: sale price beats b2b when lower", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-030", "sale price beats b2b when lower", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-030",
        title: "sale price beats b2b when lower",
        file: "listingPricing.test.js",
        testName: "sale price beats b2b when lower",
        runner: "jest",
        slug: "listing-pricing",
      });
    });
  });
});
