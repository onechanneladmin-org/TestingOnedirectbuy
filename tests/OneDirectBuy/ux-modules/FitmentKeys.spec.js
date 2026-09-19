import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Fitment Keys", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-031: buildProgressiveKeysFromVehicle base and full key", async ({ soft }) => {
    await soft("ODB-UX-031", "buildProgressiveKeysFromVehicle base and full key", async () => {
      await runUxModuleCase({
        file: "fitmentKeys.test.js",
        testName: "buildProgressiveKeysFromVehicle base and full key",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-032: buildUserFitmentKeys YMM exact", async ({ soft }) => {
    await soft("ODB-UX-032", "buildUserFitmentKeys YMM exact", async () => {
      await runUxModuleCase({
        file: "fitmentKeys.test.js",
        testName: "buildUserFitmentKeys YMM exact",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-033: computeFitmentKeysFromEntries dedupes", async ({ soft }) => {
    await soft("ODB-UX-033", "computeFitmentKeysFromEntries dedupes", async () => {
      await runUxModuleCase({
        file: "fitmentKeys.test.js",
        testName: "computeFitmentKeysFromEntries dedupes",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-034: extractYearsFromFitmentKeys", async ({ soft }) => {
    await soft("ODB-UX-034", "extractYearsFromFitmentKeys", async () => {
      await runUxModuleCase({
        file: "fitmentKeys.test.js",
        testName: "extractYearsFromFitmentKeys",
        runner: "jest",
      });
    });
  });
});
