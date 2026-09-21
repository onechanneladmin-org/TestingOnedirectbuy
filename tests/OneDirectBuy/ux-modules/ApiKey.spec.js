import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — API Keys", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-072: API key generated and shown once — raw key shown once and only hashed value stored", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-072", "API key generated and shown once — raw key shown once and only hashed value stored", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-072",
        title: "API key generated and shown once — raw key shown once and only hashed value stored",
        file: "api/apiKey.test.js",
        testName: "API key generated and shown once — raw key shown once and only hashed value stored",
        runner: "jest",
        slug: "api-key",
      });
    });
  });

  test("ODB-UX-073: Revoked API key blocked — API returns unauthorized", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-073", "Revoked API key blocked — API returns unauthorized", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-073",
        title: "Revoked API key blocked — API returns unauthorized",
        file: "api/apiKey.test.js",
        testName: "Revoked API key blocked — API returns unauthorized",
        runner: "jest",
        slug: "api-key",
      });
    });
  });

  test("ODB-UX-074: API key scope enforcement — endpoint outside scope returns forbidden", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-074", "API key scope enforcement — endpoint outside scope returns forbidden", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-074",
        title: "API key scope enforcement — endpoint outside scope returns forbidden",
        file: "api/apiKey.test.js",
        testName: "API key scope enforcement — endpoint outside scope returns forbidden",
        runner: "jest",
        slug: "api-key",
      });
    });
  });

  test("ODB-UX-075: API key rate limit — exceeding threshold returns 429 and rate limit headers", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-075", "API key rate limit — exceeding threshold returns 429 and rate limit headers", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-075",
        title: "API key rate limit — exceeding threshold returns 429 and rate limit headers",
        file: "api/apiKey.test.js",
        testName: "API key rate limit — exceeding threshold returns 429 and rate limit headers",
        runner: "jest",
        slug: "api-key",
      });
    });
  });

  test("ODB-UX-076: API usage logging — records key ID, endpoint, status, latency, and timestamp", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-076", "API usage logging — records key ID, endpoint, status, latency, and timestamp", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-076",
        title: "API usage logging — records key ID, endpoint, status, latency, and timestamp",
        file: "api/apiKey.test.js",
        testName: "API usage logging — records key ID, endpoint, status, latency, and timestamp",
        runner: "jest",
        slug: "api-key",
      });
    });
  });
});
