import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Multi-Seller Order", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-019: multi-seller: one seller shipped keeps parent processing", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-019", "multi-seller: one seller shipped keeps parent processing", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-019",
        title: "multi-seller: one seller shipped keeps parent processing",
        file: "multiSellerOrder.test.js",
        testName: "multi-seller: one seller shipped keeps parent processing",
        runner: "node:test",
        slug: "multi-seller-order",
      });
    });
  });

  test("ODB-UX-020: multi-seller: all sellers shipped marks parent shipped", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-020", "multi-seller: all sellers shipped marks parent shipped", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-020",
        title: "multi-seller: all sellers shipped marks parent shipped",
        file: "multiSellerOrder.test.js",
        testName: "multi-seller: all sellers shipped marks parent shipped",
        runner: "node:test",
        slug: "multi-seller-order",
      });
    });
  });

  test("ODB-UX-021: multi-seller: parent totals reconcile per seller lines", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-021", "multi-seller: parent totals reconcile per seller lines", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-021",
        title: "multi-seller: parent totals reconcile per seller lines",
        file: "multiSellerOrder.test.js",
        testName: "multi-seller: parent totals reconcile per seller lines",
        runner: "node:test",
        slug: "multi-seller-order",
      });
    });
  });
});
