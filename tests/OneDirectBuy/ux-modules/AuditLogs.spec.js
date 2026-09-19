import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Audit Logs", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-054: Security event logged — invalid token triggers audit log without sensitive data leakage", async ({ soft }) => {
    await soft("ODB-UX-054", "Security event logged — invalid token triggers audit log without sensitive data leakage", async () => {
      await runUxModuleCase({
        file: "security/auditLogs.test.js",
        testName: "Security event logged — invalid token triggers audit log without sensitive data leakage",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-055: Security event logged — forbidden scope triggers audit log without sensitive data leakage", async ({ soft }) => {
    await soft("ODB-UX-055", "Security event logged — forbidden scope triggers audit log without sensitive data leakage", async () => {
      await runUxModuleCase({
        file: "security/auditLogs.test.js",
        testName: "Security event logged — forbidden scope triggers audit log without sensitive data leakage",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-056: Security event logged — invalid API key triggers audit log without sensitive data leakage", async ({ soft }) => {
    await soft("ODB-UX-056", "Security event logged — invalid API key triggers audit log without sensitive data leakage", async () => {
      await runUxModuleCase({
        file: "security/auditLogs.test.js",
        testName: "Security event logged — invalid API key triggers audit log without sensitive data leakage",
        runner: "jest",
      });
    });
  });
});
