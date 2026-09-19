import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — API Keys", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-072: API key generated and shown once — raw key shown once and only hashed value stored", async ({ soft }) => {
    await soft("ODB-UX-072", "API key generated and shown once — raw key shown once and only hashed value stored", async () => {
      await runUxModuleCase({
        file: "api/apiKey.test.js",
        testName: "API key generated and shown once — raw key shown once and only hashed value stored",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-073: Revoked API key blocked — API returns unauthorized", async ({ soft }) => {
    await soft("ODB-UX-073", "Revoked API key blocked — API returns unauthorized", async () => {
      await runUxModuleCase({
        file: "api/apiKey.test.js",
        testName: "Revoked API key blocked — API returns unauthorized",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-074: API key scope enforcement — endpoint outside scope returns forbidden", async ({ soft }) => {
    await soft("ODB-UX-074", "API key scope enforcement — endpoint outside scope returns forbidden", async () => {
      await runUxModuleCase({
        file: "api/apiKey.test.js",
        testName: "API key scope enforcement — endpoint outside scope returns forbidden",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-075: API key rate limit — exceeding threshold returns 429 and rate limit headers", async ({ soft }) => {
    await soft("ODB-UX-075", "API key rate limit — exceeding threshold returns 429 and rate limit headers", async () => {
      await runUxModuleCase({
        file: "api/apiKey.test.js",
        testName: "API key rate limit — exceeding threshold returns 429 and rate limit headers",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-076: API usage logging — records key ID, endpoint, status, latency, and timestamp", async ({ soft }) => {
    await soft("ODB-UX-076", "API usage logging — records key ID, endpoint, status, latency, and timestamp", async () => {
      await runUxModuleCase({
        file: "api/apiKey.test.js",
        testName: "API usage logging — records key ID, endpoint, status, latency, and timestamp",
        runner: "jest",
      });
    });
  });
});
