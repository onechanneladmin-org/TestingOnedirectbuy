import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Job Queue", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-067: Failed job retry — worker retries according to retry policy", async ({ soft }) => {
    await soft("ODB-UX-067", "Failed job retry — worker retries according to retry policy", async () => {
      await runUxModuleCase({
        file: "jobs/jobQueue.test.js",
        testName: "Failed job retry — worker retries according to retry policy",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-068: Dead-letter queue handling — repeated failures move job to DLQ with error details", async ({ soft }) => {
    await soft("ODB-UX-068", "Dead-letter queue handling — repeated failures move job to DLQ with error details", async () => {
      await runUxModuleCase({
        file: "jobs/jobQueue.test.js",
        testName: "Dead-letter queue handling — repeated failures move job to DLQ with error details",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-069: Job idempotency — duplicate delivery does not create duplicate side effects", async ({ soft }) => {
    await soft("ODB-UX-069", "Job idempotency — duplicate delivery does not create duplicate side effects", async () => {
      await runUxModuleCase({
        file: "jobs/jobQueue.test.js",
        testName: "Job idempotency — duplicate delivery does not create duplicate side effects",
        runner: "jest",
      });
    });
  });
});
