import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Fitment Index", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-035: fitmentEntryMatchesVehicle honors empty trim wildcard", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-035", "fitmentEntryMatchesVehicle honors empty trim wildcard", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-035",
        title: "fitmentEntryMatchesVehicle honors empty trim wildcard",
        file: "fitmentIndex.test.js",
        testName: "fitmentEntryMatchesVehicle honors empty trim wildcard",
        runner: "jest",
        slug: "fitment-index",
      });
    });
  });

  test("ODB-UX-036: computeProductVehicleFitFromIndex", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-036", "computeProductVehicleFitFromIndex", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-036",
        title: "computeProductVehicleFitFromIndex",
        file: "fitmentIndex.test.js",
        testName: "computeProductVehicleFitFromIndex",
        runner: "jest",
        slug: "fitment-index",
      });
    });
  });

  test("ODB-UX-037: buildVehicleFitProductFilter all mode includes universal", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-037", "buildVehicleFitProductFilter all mode includes universal", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-037",
        title: "buildVehicleFitProductFilter all mode includes universal",
        file: "fitmentIndex.test.js",
        testName: "buildVehicleFitProductFilter all mode includes universal",
        runner: "jest",
        slug: "fitment-index",
      });
    });
  });

  test("ODB-UX-038: buildVehicleFitProductFilter YMM-only uses fitmentKeys", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-038", "buildVehicleFitProductFilter YMM-only uses fitmentKeys", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-038",
        title: "buildVehicleFitProductFilter YMM-only uses fitmentKeys",
        file: "fitmentIndex.test.js",
        testName: "buildVehicleFitProductFilter YMM-only uses fitmentKeys",
        runner: "jest",
        slug: "fitment-index",
      });
    });
  });
});
