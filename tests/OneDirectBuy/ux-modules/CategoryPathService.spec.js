import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Category Path Service", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-039: catalogSlugVariants covers hyphen and underscore", async ({ soft }) => {
    await soft("ODB-UX-039", "catalogSlugVariants covers hyphen and underscore", async () => {
      await runUxModuleCase({
        file: "categoryPathService.test.js",
        testName: "catalogSlugVariants covers hyphen and underscore",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-040: pathSlugSegment is kebab-case", async ({ soft }) => {
    await soft("ODB-UX-040", "pathSlugSegment is kebab-case", async () => {
      await runUxModuleCase({
        file: "categoryPathService.test.js",
        testName: "pathSlugSegment is kebab-case",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-041: buildPathFields emits kebab pathKey from underscore slugs", async ({ soft }) => {
    await soft("ODB-UX-041", "buildPathFields emits kebab pathKey from underscore slugs", async () => {
      await runUxModuleCase({
        file: "categoryPathService.test.js",
        testName: "buildPathFields emits kebab pathKey from underscore slugs",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-042: normalizePathKey joins segments", async ({ soft }) => {
    await soft("ODB-UX-042", "normalizePathKey joins segments", async () => {
      await runUxModuleCase({
        file: "categoryPathService.test.js",
        testName: "normalizePathKey joins segments",
        runner: "jest",
      });
    });
  });
});
