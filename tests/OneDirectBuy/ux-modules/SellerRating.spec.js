import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Seller Rating", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-006: seller rating: cancelled order is ineligible", async ({ soft }) => {
    await soft("ODB-UX-006", "seller rating: cancelled order is ineligible", async () => {
      await runUxModuleCase({
        file: "sellerRatingService.test.js",
        testName: "seller rating: cancelled order is ineligible",
        runner: "node:test",
      });
    });
  });

  test("ODB-UX-007: seller rating: unpaid order is ineligible", async ({ soft }) => {
    await soft("ODB-UX-007", "seller rating: unpaid order is ineligible", async () => {
      await runUxModuleCase({
        file: "sellerRatingService.test.js",
        testName: "seller rating: unpaid order is ineligible",
        runner: "node:test",
      });
    });
  });

  test("ODB-UX-008: seller rating: shipped paid order is eligible", async ({ soft }) => {
    await soft("ODB-UX-008", "seller rating: shipped paid order is eligible", async () => {
      await runUxModuleCase({
        file: "sellerRatingService.test.js",
        testName: "seller rating: shipped paid order is eligible",
        runner: "node:test",
      });
    });
  });

  test("ODB-UX-009: seller rating: processing with shipped item is eligible", async ({ soft }) => {
    await soft("ODB-UX-009", "seller rating: processing with shipped item is eligible", async () => {
      await runUxModuleCase({
        file: "sellerRatingService.test.js",
        testName: "seller rating: processing with shipped item is eligible",
        runner: "node:test",
      });
    });
  });

  test("ODB-UX-010: seller rating: new paid order with no shipped items is ineligible", async ({ soft }) => {
    await soft("ODB-UX-010", "seller rating: new paid order with no shipped items is ineligible", async () => {
      await runUxModuleCase({
        file: "sellerRatingService.test.js",
        testName: "seller rating: new paid order with no shipped items is ineligible",
        runner: "node:test",
      });
    });
  });
});
