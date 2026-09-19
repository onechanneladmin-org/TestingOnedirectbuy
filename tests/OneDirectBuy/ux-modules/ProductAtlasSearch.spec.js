import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Product Atlas Search", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-011: buildFitmentKeysAtlasClause uses equals for a single YMM key", async ({ soft }) => {
    await soft("ODB-UX-011", "buildFitmentKeysAtlasClause uses equals for a single YMM key", async () => {
      await runUxModuleCase({
        file: "productAtlasSearch.test.js",
        testName: "buildFitmentKeysAtlasClause uses equals for a single YMM key",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-012: buildFitmentKeysAtlasClause uses in for multiple keys", async ({ soft }) => {
    await soft("ODB-UX-012", "buildFitmentKeysAtlasClause uses in for multiple keys", async () => {
      await runUxModuleCase({
        file: "productAtlasSearch.test.js",
        testName: "buildFitmentKeysAtlasClause uses in for multiple keys",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-013: buildVehicleFitAtlasClause includes universal for fitMode all", async ({ soft }) => {
    await soft("ODB-UX-013", "buildVehicleFitAtlasClause includes universal for fitMode all", async () => {
      await runUxModuleCase({
        file: "productAtlasSearch.test.js",
        testName: "buildVehicleFitAtlasClause includes universal for fitMode all",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-014: buildVehicleFitAtlasClause returns null when trim/engine present", async ({ soft }) => {
    await soft("ODB-UX-014", "buildVehicleFitAtlasClause returns null when trim/engine present", async () => {
      await runUxModuleCase({
        file: "productAtlasSearch.test.js",
        testName: "buildVehicleFitAtlasClause returns null when trim/engine present",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-015: buildAtlasSearchCompound status filter is approved-only", async ({ soft }) => {
    await soft("ODB-UX-015", "buildAtlasSearchCompound status filter is approved-only", async () => {
      await runUxModuleCase({
        file: "productAtlasSearch.test.js",
        testName: "buildAtlasSearchCompound status filter is approved-only",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-016: buildFallbackMongoFilter uses fitmentKeys for YMM", async ({ soft }) => {
    await soft("ODB-UX-016", "buildFallbackMongoFilter uses fitmentKeys for YMM", async () => {
      await runUxModuleCase({
        file: "productAtlasSearch.test.js",
        testName: "buildFallbackMongoFilter uses fitmentKeys for YMM",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-017: buildFallbackMongoFilter uses fitmentIndex elemMatch for trim", async ({ soft }) => {
    await soft("ODB-UX-017", "buildFallbackMongoFilter uses fitmentIndex elemMatch for trim", async () => {
      await runUxModuleCase({
        file: "productAtlasSearch.test.js",
        testName: "buildFallbackMongoFilter uses fitmentIndex elemMatch for trim",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-018: Atlas index definition includes filter fields used by search", async ({ soft }) => {
    await soft("ODB-UX-018", "Atlas index definition includes filter fields used by search", async () => {
      await runUxModuleCase({
        file: "productAtlasSearch.test.js",
        testName: "Atlas index definition includes filter fields used by search",
        runner: "jest",
      });
    });
  });
});
