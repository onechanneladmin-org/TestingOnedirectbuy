import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Variation Aggregates", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-001: summarizeListings picks cheapest listing", async ({ soft }) => {
    await soft("ODB-UX-001", "summarizeListings picks cheapest listing", async () => {
      await runUxModuleCase({
        file: "variationAggregates.test.js",
        testName: "summarizeListings picks cheapest listing",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-002: computeVariationAggregates per variant", async ({ soft }) => {
    await soft("ODB-UX-002", "computeVariationAggregates per variant", async () => {
      await runUxModuleCase({
        file: "variationAggregates.test.js",
        testName: "computeVariationAggregates per variant",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-003: listingsForEmbeddedVariant includes parent fallback", async ({ soft }) => {
    await soft("ODB-UX-003", "listingsForEmbeddedVariant includes parent fallback", async () => {
      await runUxModuleCase({
        file: "variationAggregates.test.js",
        testName: "listingsForEmbeddedVariant includes parent fallback",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-004: listingsForProductAggregate excludes parent row when variant listings exist", async ({ soft }) => {
    await soft("ODB-UX-004", "listingsForProductAggregate excludes parent row when variant listings exist", async () => {
      await runUxModuleCase({
        file: "variationAggregates.test.js",
        testName: "listingsForProductAggregate excludes parent row when variant listings exist",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-005: paginateVariantsWithPin keeps deep-linked variant", async ({ soft }) => {
    await soft("ODB-UX-005", "paginateVariantsWithPin keeps deep-linked variant", async () => {
      await runUxModuleCase({
        file: "variationAggregates.test.js",
        testName: "paginateVariantsWithPin keeps deep-linked variant",
        runner: "jest",
      });
    });
  });
});
