import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Job Queue", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-067: Failed job retry — worker retries according to retry policy", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-067", "Failed job retry — worker retries according to retry policy", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-067",
        title: "Failed job retry — worker retries according to retry policy",
        file: "jobs/jobQueue.test.js",
        testName: "Failed job retry — worker retries according to retry policy",
        runner: "jest",
        slug: "job-queue",
      });
    });
  });

  test("ODB-UX-068: Dead-letter queue handling — repeated failures move job to DLQ with error details", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-068", "Dead-letter queue handling — repeated failures move job to DLQ with error details", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-068",
        title: "Dead-letter queue handling — repeated failures move job to DLQ with error details",
        file: "jobs/jobQueue.test.js",
        testName: "Dead-letter queue handling — repeated failures move job to DLQ with error details",
        runner: "jest",
        slug: "job-queue",
      });
    });
  });

  test("ODB-UX-069: Job idempotency — duplicate delivery does not create duplicate side effects", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-069", "Job idempotency — duplicate delivery does not create duplicate side effects", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-069",
        title: "Job idempotency — duplicate delivery does not create duplicate side effects",
        file: "jobs/jobQueue.test.js",
        testName: "Job idempotency — duplicate delivery does not create duplicate side effects",
        runner: "jest",
        slug: "job-queue",
      });
    });
  });
});
