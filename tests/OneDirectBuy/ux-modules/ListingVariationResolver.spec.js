import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Listing Variation Resolver", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-022: isListingBuyable accepts legacy rows without status", async ({ soft }) => {
    await soft("ODB-UX-022", "isListingBuyable accepts legacy rows without status", async () => {
      await runUxModuleCase({
        file: "listingVariationResolver.test.js",
        testName: "isListingBuyable accepts legacy rows without status",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-023: resolveListingProductId returns the catalog product id", async ({ soft }) => {
    await soft("ODB-UX-023", "resolveListingProductId returns the catalog product id", async () => {
      await runUxModuleCase({
        file: "listingVariationResolver.test.js",
        testName: "resolveListingProductId returns the catalog product id",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-024: resolveActiveListingForCart resolves by productId and variationId", async ({ soft }) => {
    await soft("ODB-UX-024", "resolveActiveListingForCart resolves by productId and variationId", async () => {
      await runUxModuleCase({
        file: "listingVariationResolver.test.js",
        testName: "resolveActiveListingForCart resolves by productId and variationId",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-025: resolveActiveListingForCart falls back from inactive listingId when productId is provided", async ({ soft }) => {
    await soft("ODB-UX-025", "resolveActiveListingForCart falls back from inactive listingId when productId is provided", async () => {
      await runUxModuleCase({
        file: "listingVariationResolver.test.js",
        testName: "resolveActiveListingForCart falls back from inactive listingId when productId is provided",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-026: parentListingFallbackForEmbeddedVariant matches parent listing rows", async ({ soft }) => {
    await soft("ODB-UX-026", "parentListingFallbackForEmbeddedVariant matches parent listing rows", async () => {
      await runUxModuleCase({
        file: "listingVariationResolver.test.js",
        testName: "parentListingFallbackForEmbeddedVariant matches parent listing rows",
        runner: "jest",
      });
    });
  });
});
