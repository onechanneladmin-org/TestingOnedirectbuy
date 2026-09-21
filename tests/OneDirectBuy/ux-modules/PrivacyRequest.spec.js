import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Privacy Request", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-061: Data access export includes allowed records and excludes restricted internal data", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-061", "Data access export includes allowed records and excludes restricted internal data", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-061",
        title: "Data access export includes allowed records and excludes restricted internal data",
        file: "privacy/privacyRequest.test.js",
        testName: "Data access export includes allowed records and excludes restricted internal data",
        runner: "jest",
        slug: "privacy-request",
      });
    });
  });

  test("ODB-UX-062: Deletion respects legal retention — orders retained and personal fields anonymized", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-062", "Deletion respects legal retention — orders retained and personal fields anonymized", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-062",
        title: "Deletion respects legal retention — orders retained and personal fields anonymized",
        file: "privacy/privacyRequest.test.js",
        testName: "Deletion respects legal retention — orders retained and personal fields anonymized",
        runner: "jest",
        slug: "privacy-request",
      });
    });
  });

  test("ODB-UX-063: Privacy request audit log records action, admin, timestamp, reason, and result", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-063", "Privacy request audit log records action, admin, timestamp, reason, and result", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-063",
        title: "Privacy request audit log records action, admin, timestamp, reason, and result",
        file: "privacy/privacyRequest.test.js",
        testName: "Privacy request audit log records action, admin, timestamp, reason, and result",
        runner: "jest",
        slug: "privacy-request",
      });
    });
  });
});
