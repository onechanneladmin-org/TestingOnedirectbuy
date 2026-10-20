import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Listing Variation Resolver", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-022: isListingBuyable accepts legacy rows without status", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-022", "isListingBuyable accepts legacy rows without status", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-022",
        title: "isListingBuyable accepts legacy rows without status",
        file: "listingVariationResolver.test.js",
        testName: "isListingBuyable accepts legacy rows without status",
        runner: "jest",
        slug: "listing-variation-resolver",
      });
    });
  });

  test("ODB-UX-023: resolveListingProductId returns the catalog product id", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-023", "resolveListingProductId returns the catalog product id", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-023",
        title: "resolveListingProductId returns the catalog product id",
        file: "listingVariationResolver.test.js",
        testName: "resolveListingProductId returns the catalog product id",
        runner: "jest",
        slug: "listing-variation-resolver",
      });
    });
  });

  test("ODB-UX-024: resolveActiveListingForCart resolves by productId and variationId", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-024", "resolveActiveListingForCart resolves by productId and variationId", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-024",
        title: "resolveActiveListingForCart resolves by productId and variationId",
        file: "listingVariationResolver.test.js",
        testName: "resolveActiveListingForCart resolves by productId and variationId",
        runner: "jest",
        slug: "listing-variation-resolver",
      });
    });
  });

  test("ODB-UX-025: resolveActiveListingForCart falls back from inactive listingId when productId is provided", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-025", "resolveActiveListingForCart falls back from inactive listingId when productId is provided", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-025",
        title: "resolveActiveListingForCart falls back from inactive listingId when productId is provided",
        file: "listingVariationResolver.test.js",
        testName: "resolveActiveListingForCart falls back from inactive listingId when productId is provided",
        runner: "jest",
        slug: "listing-variation-resolver",
      });
    });
  });

  test("ODB-UX-026: parentListingFallbackForEmbeddedVariant matches parent listing rows", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-026", "parentListingFallbackForEmbeddedVariant matches parent listing rows", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-026",
        title: "parentListingFallbackForEmbeddedVariant matches parent listing rows",
        file: "listingVariationResolver.test.js",
        testName: "parentListingFallbackForEmbeddedVariant matches parent listing rows",
        runner: "jest",
        slug: "listing-variation-resolver",
      });
    });
  });
});
