import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Fitment Index", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-035: fitmentEntryMatchesVehicle honors empty trim wildcard", async ({ soft }) => {
    await soft("ODB-UX-035", "fitmentEntryMatchesVehicle honors empty trim wildcard", async () => {
      await runUxModuleCase({
        file: "fitmentIndex.test.js",
        testName: "fitmentEntryMatchesVehicle honors empty trim wildcard",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-036: computeProductVehicleFitFromIndex", async ({ soft }) => {
    await soft("ODB-UX-036", "computeProductVehicleFitFromIndex", async () => {
      await runUxModuleCase({
        file: "fitmentIndex.test.js",
        testName: "computeProductVehicleFitFromIndex",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-037: buildVehicleFitProductFilter all mode includes universal", async ({ soft }) => {
    await soft("ODB-UX-037", "buildVehicleFitProductFilter all mode includes universal", async () => {
      await runUxModuleCase({
        file: "fitmentIndex.test.js",
        testName: "buildVehicleFitProductFilter all mode includes universal",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-038: buildVehicleFitProductFilter YMM-only uses fitmentKeys", async ({ soft }) => {
    await soft("ODB-UX-038", "buildVehicleFitProductFilter YMM-only uses fitmentKeys", async () => {
      await runUxModuleCase({
        file: "fitmentIndex.test.js",
        testName: "buildVehicleFitProductFilter YMM-only uses fitmentKeys",
        runner: "jest",
      });
    });
  });
});
