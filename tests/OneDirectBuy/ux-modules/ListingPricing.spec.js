import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Listing Pricing", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-027: normalizeB2bPricingInput sorts and dedupes tiers", async ({ soft }) => {
    await soft("ODB-UX-027", "normalizeB2bPricingInput sorts and dedupes tiers", async () => {
      await runUxModuleCase({
        file: "listingPricing.test.js",
        testName: "normalizeB2bPricingInput sorts and dedupes tiers",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-028: resolveB2bUnitPrice picks highest qualifying tier", async ({ soft }) => {
    await soft("ODB-UX-028", "resolveB2bUnitPrice picks highest qualifying tier", async () => {
      await runUxModuleCase({
        file: "listingPricing.test.js",
        testName: "resolveB2bUnitPrice picks highest qualifying tier",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-029: getListingLineUnitPrice uses min(consumer, b2b)", async ({ soft }) => {
    await soft("ODB-UX-029", "getListingLineUnitPrice uses min(consumer, b2b)", async () => {
      await runUxModuleCase({
        file: "listingPricing.test.js",
        testName: "getListingLineUnitPrice uses min(consumer, b2b)",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-030: sale price beats b2b when lower", async ({ soft }) => {
    await soft("ODB-UX-030", "sale price beats b2b when lower", async () => {
      await runUxModuleCase({
        file: "listingPricing.test.js",
        testName: "sale price beats b2b when lower",
        runner: "jest",
      });
    });
  });
});
