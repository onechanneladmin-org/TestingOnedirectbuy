import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Multi-Seller Order", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-019: multi-seller: one seller shipped keeps parent processing", async ({ soft }) => {
    await soft("ODB-UX-019", "multi-seller: one seller shipped keeps parent processing", async () => {
      await runUxModuleCase({
        file: "multiSellerOrder.test.js",
        testName: "multi-seller: one seller shipped keeps parent processing",
        runner: "node:test",
      });
    });
  });

  test("ODB-UX-020: multi-seller: all sellers shipped marks parent shipped", async ({ soft }) => {
    await soft("ODB-UX-020", "multi-seller: all sellers shipped marks parent shipped", async () => {
      await runUxModuleCase({
        file: "multiSellerOrder.test.js",
        testName: "multi-seller: all sellers shipped marks parent shipped",
        runner: "node:test",
      });
    });
  });

  test("ODB-UX-021: multi-seller: parent totals reconcile per seller lines", async ({ soft }) => {
    await soft("ODB-UX-021", "multi-seller: parent totals reconcile per seller lines", async () => {
      await runUxModuleCase({
        file: "multiSellerOrder.test.js",
        testName: "multi-seller: parent totals reconcile per seller lines",
        runner: "node:test",
      });
    });
  });
});
