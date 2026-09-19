import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Catalog Validation", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-043: product validation requires title, brand, category, images, mpn, gtin or exemption", async ({ soft }) => {
    await soft("ODB-UX-043", "product validation requires title, brand, category, images, mpn, gtin or exemption", async () => {
      await runUxModuleCase({
        file: "catalogValidation.test.js",
        testName: "product validation requires title, brand, category, images, mpn, gtin or exemption",
        runner: "node:test",
      });
    });
  });

  test("ODB-UX-044: product validation rejects missing images and mpn", async ({ soft }) => {
    await soft("ODB-UX-044", "product validation rejects missing images and mpn", async () => {
      await runUxModuleCase({
        file: "catalogValidation.test.js",
        testName: "product validation rejects missing images and mpn",
        runner: "node:test",
      });
    });
  });

  test("ODB-UX-045: listing validation requires price greater than zero and qty", async ({ soft }) => {
    await soft("ODB-UX-045", "listing validation requires price greater than zero and qty", async () => {
      await runUxModuleCase({
        file: "catalogValidation.test.js",
        testName: "listing validation requires price greater than zero and qty",
        runner: "node:test",
      });
    });
  });
});
