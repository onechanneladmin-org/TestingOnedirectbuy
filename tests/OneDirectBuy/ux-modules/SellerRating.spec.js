import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Seller Rating", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-006: seller rating: cancelled order is ineligible", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-006", "seller rating: cancelled order is ineligible", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-006",
        title: "seller rating: cancelled order is ineligible",
        file: "sellerRatingService.test.js",
        testName: "seller rating: cancelled order is ineligible",
        runner: "node:test",
        slug: "seller-rating",
      });
    });
  });

  test("ODB-UX-007: seller rating: unpaid order is ineligible", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-007", "seller rating: unpaid order is ineligible", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-007",
        title: "seller rating: unpaid order is ineligible",
        file: "sellerRatingService.test.js",
        testName: "seller rating: unpaid order is ineligible",
        runner: "node:test",
        slug: "seller-rating",
      });
    });
  });

  test("ODB-UX-008: seller rating: shipped paid order is eligible", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-008", "seller rating: shipped paid order is eligible", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-008",
        title: "seller rating: shipped paid order is eligible",
        file: "sellerRatingService.test.js",
        testName: "seller rating: shipped paid order is eligible",
        runner: "node:test",
        slug: "seller-rating",
      });
    });
  });

  test("ODB-UX-009: seller rating: processing with shipped item is eligible", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-009", "seller rating: processing with shipped item is eligible", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-009",
        title: "seller rating: processing with shipped item is eligible",
        file: "sellerRatingService.test.js",
        testName: "seller rating: processing with shipped item is eligible",
        runner: "node:test",
        slug: "seller-rating",
      });
    });
  });

  test("ODB-UX-010: seller rating: new paid order with no shipped items is ineligible", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-010", "seller rating: new paid order with no shipped items is ineligible", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-010",
        title: "seller rating: new paid order with no shipped items is ineligible",
        file: "sellerRatingService.test.js",
        testName: "seller rating: new paid order with no shipped items is ineligible",
        runner: "node:test",
        slug: "seller-rating",
      });
    });
  });
});
