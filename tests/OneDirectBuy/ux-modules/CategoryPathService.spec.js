import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Category Path Service", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-039: catalogSlugVariants covers hyphen and underscore", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-039", "catalogSlugVariants covers hyphen and underscore", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-039",
        title: "catalogSlugVariants covers hyphen and underscore",
        file: "categoryPathService.test.js",
        testName: "catalogSlugVariants covers hyphen and underscore",
        runner: "jest",
        slug: "category-path-service",
      });
    });
  });

  test("ODB-UX-040: pathSlugSegment is kebab-case", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-040", "pathSlugSegment is kebab-case", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-040",
        title: "pathSlugSegment is kebab-case",
        file: "categoryPathService.test.js",
        testName: "pathSlugSegment is kebab-case",
        runner: "jest",
        slug: "category-path-service",
      });
    });
  });

  test("ODB-UX-041: buildPathFields emits kebab pathKey from underscore slugs", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-041", "buildPathFields emits kebab pathKey from underscore slugs", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-041",
        title: "buildPathFields emits kebab pathKey from underscore slugs",
        file: "categoryPathService.test.js",
        testName: "buildPathFields emits kebab pathKey from underscore slugs",
        runner: "jest",
        slug: "category-path-service",
      });
    });
  });

  test("ODB-UX-042: normalizePathKey joins segments", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-042", "normalizePathKey joins segments", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-042",
        title: "normalizePathKey joins segments",
        file: "categoryPathService.test.js",
        testName: "normalizePathKey joins segments",
        runner: "jest",
        slug: "category-path-service",
      });
    });
  });
});
