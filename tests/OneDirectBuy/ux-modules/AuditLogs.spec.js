import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Audit Logs", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-054: Security event logged — invalid token triggers audit log without sensitive data leakage", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-054", "Security event logged — invalid token triggers audit log without sensitive data leakage", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-054",
        title: "Security event logged — invalid token triggers audit log without sensitive data leakage",
        file: "security/auditLogs.test.js",
        testName: "Security event logged — invalid token triggers audit log without sensitive data leakage",
        runner: "jest",
        slug: "audit-logs",
      });
    });
  });

  test("ODB-UX-055: Security event logged — forbidden scope triggers audit log without sensitive data leakage", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-055", "Security event logged — forbidden scope triggers audit log without sensitive data leakage", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-055",
        title: "Security event logged — forbidden scope triggers audit log without sensitive data leakage",
        file: "security/auditLogs.test.js",
        testName: "Security event logged — forbidden scope triggers audit log without sensitive data leakage",
        runner: "jest",
        slug: "audit-logs",
      });
    });
  });

  test("ODB-UX-056: Security event logged — invalid API key triggers audit log without sensitive data leakage", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-056", "Security event logged — invalid API key triggers audit log without sensitive data leakage", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-056",
        title: "Security event logged — invalid API key triggers audit log without sensitive data leakage",
        file: "security/auditLogs.test.js",
        testName: "Security event logged — invalid API key triggers audit log without sensitive data leakage",
        runner: "jest",
        slug: "audit-logs",
      });
    });
  });
});
