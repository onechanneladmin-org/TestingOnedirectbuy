import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Scheduled Jobs", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-064: Scheduled job runs once per period — duplicate trigger records only one logical run", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-064", "Scheduled job runs once per period — duplicate trigger records only one logical run", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-064",
        title: "Scheduled job runs once per period — duplicate trigger records only one logical run",
        file: "jobs/scheduledJobs.test.js",
        testName: "Scheduled job runs once per period — duplicate trigger records only one logical run",
        runner: "jest",
        slug: "scheduled-jobs",
      });
    });
  });

  test("ODB-UX-065: Missed job recovery — scheduler restart logs missed critical periods per policy", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-065", "Missed job recovery — scheduler restart logs missed critical periods per policy", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-065",
        title: "Missed job recovery — scheduler restart logs missed critical periods per policy",
        file: "jobs/scheduledJobs.test.js",
        testName: "Missed job recovery — scheduler restart logs missed critical periods per policy",
        runner: "jest",
        slug: "scheduled-jobs",
      });
    });
  });

  test("ODB-UX-066: Missed job recovery — run policy executes missed period once on restart", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-066", "Missed job recovery — run policy executes missed period once on restart", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-066",
        title: "Missed job recovery — run policy executes missed period once on restart",
        file: "jobs/scheduledJobs.test.js",
        testName: "Missed job recovery — run policy executes missed period once on restart",
        runner: "jest",
        slug: "scheduled-jobs",
      });
    });
  });
});
