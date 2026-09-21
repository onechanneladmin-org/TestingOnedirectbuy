import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Catalog Validation", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-043: product validation requires title, brand, category, images, mpn, gtin or exemption", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-043", "product validation requires title, brand, category, images, mpn, gtin or exemption", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-043",
        title: "product validation requires title, brand, category, images, mpn, gtin or exemption",
        file: "catalogValidation.test.js",
        testName: "product validation requires title, brand, category, images, mpn, gtin or exemption",
        runner: "node:test",
        slug: "catalog-validation",
      });
    });
  });

  test("ODB-UX-044: product validation rejects missing images and mpn", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-044", "product validation rejects missing images and mpn", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-044",
        title: "product validation rejects missing images and mpn",
        file: "catalogValidation.test.js",
        testName: "product validation rejects missing images and mpn",
        runner: "node:test",
        slug: "catalog-validation",
      });
    });
  });

  test("ODB-UX-045: listing validation requires price greater than zero and qty", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-045", "listing validation requires price greater than zero and qty", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-045",
        title: "listing validation requires price greater than zero and qty",
        file: "catalogValidation.test.js",
        testName: "listing validation requires price greater than zero and qty",
        runner: "node:test",
        slug: "catalog-validation",
      });
    });
  });
});
