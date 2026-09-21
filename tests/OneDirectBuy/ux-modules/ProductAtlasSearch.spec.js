import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Product Atlas Search", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-011: buildFitmentKeysAtlasClause uses equals for a single YMM key", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-011", "buildFitmentKeysAtlasClause uses equals for a single YMM key", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-011",
        title: "buildFitmentKeysAtlasClause uses equals for a single YMM key",
        file: "productAtlasSearch.test.js",
        testName: "buildFitmentKeysAtlasClause uses equals for a single YMM key",
        runner: "jest",
        slug: "product-atlas-search",
      });
    });
  });

  test("ODB-UX-012: buildFitmentKeysAtlasClause uses in for multiple keys", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-012", "buildFitmentKeysAtlasClause uses in for multiple keys", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-012",
        title: "buildFitmentKeysAtlasClause uses in for multiple keys",
        file: "productAtlasSearch.test.js",
        testName: "buildFitmentKeysAtlasClause uses in for multiple keys",
        runner: "jest",
        slug: "product-atlas-search",
      });
    });
  });

  test("ODB-UX-013: buildVehicleFitAtlasClause includes universal for fitMode all", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-013", "buildVehicleFitAtlasClause includes universal for fitMode all", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-013",
        title: "buildVehicleFitAtlasClause includes universal for fitMode all",
        file: "productAtlasSearch.test.js",
        testName: "buildVehicleFitAtlasClause includes universal for fitMode all",
        runner: "jest",
        slug: "product-atlas-search",
      });
    });
  });

  test("ODB-UX-014: buildVehicleFitAtlasClause returns null when trim/engine present", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-014", "buildVehicleFitAtlasClause returns null when trim/engine present", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-014",
        title: "buildVehicleFitAtlasClause returns null when trim/engine present",
        file: "productAtlasSearch.test.js",
        testName: "buildVehicleFitAtlasClause returns null when trim/engine present",
        runner: "jest",
        slug: "product-atlas-search",
      });
    });
  });

  test("ODB-UX-015: buildAtlasSearchCompound status filter is approved-only", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-015", "buildAtlasSearchCompound status filter is approved-only", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-015",
        title: "buildAtlasSearchCompound status filter is approved-only",
        file: "productAtlasSearch.test.js",
        testName: "buildAtlasSearchCompound status filter is approved-only",
        runner: "jest",
        slug: "product-atlas-search",
      });
    });
  });

  test("ODB-UX-016: buildFallbackMongoFilter uses fitmentKeys for YMM", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-016", "buildFallbackMongoFilter uses fitmentKeys for YMM", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-016",
        title: "buildFallbackMongoFilter uses fitmentKeys for YMM",
        file: "productAtlasSearch.test.js",
        testName: "buildFallbackMongoFilter uses fitmentKeys for YMM",
        runner: "jest",
        slug: "product-atlas-search",
      });
    });
  });

  test("ODB-UX-017: buildFallbackMongoFilter uses fitmentIndex elemMatch for trim", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-017", "buildFallbackMongoFilter uses fitmentIndex elemMatch for trim", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-017",
        title: "buildFallbackMongoFilter uses fitmentIndex elemMatch for trim",
        file: "productAtlasSearch.test.js",
        testName: "buildFallbackMongoFilter uses fitmentIndex elemMatch for trim",
        runner: "jest",
        slug: "product-atlas-search",
      });
    });
  });

  test("ODB-UX-018: Atlas index definition includes filter fields used by search", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-018", "Atlas index definition includes filter fields used by search", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-018",
        title: "Atlas index definition includes filter fields used by search",
        file: "productAtlasSearch.test.js",
        testName: "Atlas index definition includes filter fields used by search",
        runner: "jest",
        slug: "product-atlas-search",
      });
    });
  });
});
