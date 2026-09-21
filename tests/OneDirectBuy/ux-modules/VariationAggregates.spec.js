import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Variation Aggregates", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-001: summarizeListings picks cheapest listing", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-001", "summarizeListings picks cheapest listing", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-001",
        title: "summarizeListings picks cheapest listing",
        file: "variationAggregates.test.js",
        testName: "summarizeListings picks cheapest listing",
        runner: "jest",
        slug: "variation-aggregates",
      });
    });
  });

  test("ODB-UX-002: computeVariationAggregates per variant", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-002", "computeVariationAggregates per variant", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-002",
        title: "computeVariationAggregates per variant",
        file: "variationAggregates.test.js",
        testName: "computeVariationAggregates per variant",
        runner: "jest",
        slug: "variation-aggregates",
      });
    });
  });

  test("ODB-UX-003: listingsForEmbeddedVariant includes parent fallback", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-003", "listingsForEmbeddedVariant includes parent fallback", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-003",
        title: "listingsForEmbeddedVariant includes parent fallback",
        file: "variationAggregates.test.js",
        testName: "listingsForEmbeddedVariant includes parent fallback",
        runner: "jest",
        slug: "variation-aggregates",
      });
    });
  });

  test("ODB-UX-004: listingsForProductAggregate excludes parent row when variant listings exist", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-004", "listingsForProductAggregate excludes parent row when variant listings exist", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-004",
        title: "listingsForProductAggregate excludes parent row when variant listings exist",
        file: "variationAggregates.test.js",
        testName: "listingsForProductAggregate excludes parent row when variant listings exist",
        runner: "jest",
        slug: "variation-aggregates",
      });
    });
  });

  test("ODB-UX-005: paginateVariantsWithPin keeps deep-linked variant", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-005", "paginateVariantsWithPin keeps deep-linked variant", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-005",
        title: "paginateVariantsWithPin keeps deep-linked variant",
        file: "variationAggregates.test.js",
        testName: "paginateVariantsWithPin keeps deep-linked variant",
        runner: "jest",
        slug: "variation-aggregates",
      });
    });
  });
});
