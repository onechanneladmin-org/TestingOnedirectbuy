import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Seller Status", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-046: resolveSellerStatus keeps pending applications blocked", async ({ soft }) => {
    await soft("ODB-UX-046", "resolveSellerStatus keeps pending applications blocked", async () => {
      await runUxModuleCase({
        file: "sellers/sellerStatusService.test.js",
        testName: "resolveSellerStatus keeps pending applications blocked",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-047: resolveSellerStatus does not treat pending+active as operational", async ({ soft }) => {
    await soft("ODB-UX-047", "resolveSellerStatus does not treat pending+active as operational", async () => {
      await runUxModuleCase({
        file: "sellers/sellerStatusService.test.js",
        testName: "resolveSellerStatus does not treat pending+active as operational",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-048: active sellers can accept orders when permitted", async ({ soft }) => {
    await soft("ODB-UX-048", "active sellers can accept orders when permitted", async () => {
      await runUxModuleCase({
        file: "sellers/sellerStatusService.test.js",
        testName: "active sellers can accept orders when permitted",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-049: resolveSellerStatus honors active=false even when status is active", async ({ soft }) => {
    await soft("ODB-UX-049", "resolveSellerStatus honors active=false even when status is active", async () => {
      await runUxModuleCase({
        file: "sellers/sellerStatusService.test.js",
        testName: "resolveSellerStatus honors active=false even when status is active",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-050: legacy sellers without status use active flag", async ({ soft }) => {
    await soft("ODB-UX-050", "legacy sellers without status use active flag", async () => {
      await runUxModuleCase({
        file: "sellers/sellerStatusService.test.js",
        testName: "legacy sellers without status use active flag",
        runner: "jest",
      });
    });
  });
});
