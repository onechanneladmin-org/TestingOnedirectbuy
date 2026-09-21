import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Seller Status", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-046: resolveSellerStatus keeps pending applications blocked", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-046", "resolveSellerStatus keeps pending applications blocked", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-046",
        title: "resolveSellerStatus keeps pending applications blocked",
        file: "sellers/sellerStatusService.test.js",
        testName: "resolveSellerStatus keeps pending applications blocked",
        runner: "jest",
        slug: "seller-status",
      });
    });
  });

  test("ODB-UX-047: resolveSellerStatus does not treat pending+active as operational", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-047", "resolveSellerStatus does not treat pending+active as operational", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-047",
        title: "resolveSellerStatus does not treat pending+active as operational",
        file: "sellers/sellerStatusService.test.js",
        testName: "resolveSellerStatus does not treat pending+active as operational",
        runner: "jest",
        slug: "seller-status",
      });
    });
  });

  test("ODB-UX-048: active sellers can accept orders when permitted", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-048", "active sellers can accept orders when permitted", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-048",
        title: "active sellers can accept orders when permitted",
        file: "sellers/sellerStatusService.test.js",
        testName: "active sellers can accept orders when permitted",
        runner: "jest",
        slug: "seller-status",
      });
    });
  });

  test("ODB-UX-049: resolveSellerStatus honors active=false even when status is active", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-049", "resolveSellerStatus honors active=false even when status is active", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-049",
        title: "resolveSellerStatus honors active=false even when status is active",
        file: "sellers/sellerStatusService.test.js",
        testName: "resolveSellerStatus honors active=false even when status is active",
        runner: "jest",
        slug: "seller-status",
      });
    });
  });

  test("ODB-UX-050: legacy sellers without status use active flag", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-050", "legacy sellers without status use active flag", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-050",
        title: "legacy sellers without status use active flag",
        file: "sellers/sellerStatusService.test.js",
        testName: "legacy sellers without status use active flag",
        runner: "jest",
        slug: "seller-status",
      });
    });
  });
});
