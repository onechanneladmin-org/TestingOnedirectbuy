import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Transaction Integrity", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-070: Checkout transaction rollback — mid-process failure leaves no partial records", async ({ soft }) => {
    await soft("ODB-UX-070", "Checkout transaction rollback — mid-process failure leaves no partial records", async () => {
      await runUxModuleCase({
        file: "database/transactionIntegrity.test.js",
        testName: "Checkout transaction rollback — mid-process failure leaves no partial records",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-071: Checkout transaction commit — successful checkout updates inventory and cart atomically", async ({ soft }) => {
    await soft("ODB-UX-071", "Checkout transaction commit — successful checkout updates inventory and cart atomically", async () => {
      await runUxModuleCase({
        file: "database/transactionIntegrity.test.js",
        testName: "Checkout transaction commit — successful checkout updates inventory and cart atomically",
        runner: "jest",
      });
    });
  });
});
