import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Scheduled Jobs", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-064: Scheduled job runs once per period — duplicate trigger records only one logical run", async ({ soft }) => {
    await soft("ODB-UX-064", "Scheduled job runs once per period — duplicate trigger records only one logical run", async () => {
      await runUxModuleCase({
        file: "jobs/scheduledJobs.test.js",
        testName: "Scheduled job runs once per period — duplicate trigger records only one logical run",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-065: Missed job recovery — scheduler restart logs missed critical periods per policy", async ({ soft }) => {
    await soft("ODB-UX-065", "Missed job recovery — scheduler restart logs missed critical periods per policy", async () => {
      await runUxModuleCase({
        file: "jobs/scheduledJobs.test.js",
        testName: "Missed job recovery — scheduler restart logs missed critical periods per policy",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-066: Missed job recovery — run policy executes missed period once on restart", async ({ soft }) => {
    await soft("ODB-UX-066", "Missed job recovery — run policy executes missed period once on restart", async () => {
      await runUxModuleCase({
        file: "jobs/scheduledJobs.test.js",
        testName: "Missed job recovery — run policy executes missed period once on restart",
        runner: "jest",
      });
    });
  });
});
