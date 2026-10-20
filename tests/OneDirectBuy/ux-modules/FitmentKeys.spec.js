import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Fitment Keys", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-031: buildProgressiveKeysFromVehicle base and full key", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-031", "buildProgressiveKeysFromVehicle base and full key", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-031",
        title: "buildProgressiveKeysFromVehicle base and full key",
        file: "fitmentKeys.test.js",
        testName: "buildProgressiveKeysFromVehicle base and full key",
        runner: "jest",
        slug: "fitment-keys",
      });
    });
  });

  test("ODB-UX-032: buildUserFitmentKeys YMM exact", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-032", "buildUserFitmentKeys YMM exact", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-032",
        title: "buildUserFitmentKeys YMM exact",
        file: "fitmentKeys.test.js",
        testName: "buildUserFitmentKeys YMM exact",
        runner: "jest",
        slug: "fitment-keys",
      });
    });
  });

  test("ODB-UX-033: computeFitmentKeysFromEntries dedupes", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-033", "computeFitmentKeysFromEntries dedupes", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-033",
        title: "computeFitmentKeysFromEntries dedupes",
        file: "fitmentKeys.test.js",
        testName: "computeFitmentKeysFromEntries dedupes",
        runner: "jest",
        slug: "fitment-keys",
      });
    });
  });

  test("ODB-UX-034: extractYearsFromFitmentKeys", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-034", "extractYearsFromFitmentKeys", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-034",
        title: "extractYearsFromFitmentKeys",
        file: "fitmentKeys.test.js",
        testName: "extractYearsFromFitmentKeys",
        runner: "jest",
        slug: "fitment-keys",
      });
    });
  });
});
