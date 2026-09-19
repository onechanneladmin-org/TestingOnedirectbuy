import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Privacy Request", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-061: Data access export includes allowed records and excludes restricted internal data", async ({ soft }) => {
    await soft("ODB-UX-061", "Data access export includes allowed records and excludes restricted internal data", async () => {
      await runUxModuleCase({
        file: "privacy/privacyRequest.test.js",
        testName: "Data access export includes allowed records and excludes restricted internal data",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-062: Deletion respects legal retention — orders retained and personal fields anonymized", async ({ soft }) => {
    await soft("ODB-UX-062", "Deletion respects legal retention — orders retained and personal fields anonymized", async () => {
      await runUxModuleCase({
        file: "privacy/privacyRequest.test.js",
        testName: "Deletion respects legal retention — orders retained and personal fields anonymized",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-063: Privacy request audit log records action, admin, timestamp, reason, and result", async ({ soft }) => {
    await soft("ODB-UX-063", "Privacy request audit log records action, admin, timestamp, reason, and result", async () => {
      await runUxModuleCase({
        file: "privacy/privacyRequest.test.js",
        testName: "Privacy request audit log records action, admin, timestamp, reason, and result",
        runner: "jest",
      });
    });
  });
});
