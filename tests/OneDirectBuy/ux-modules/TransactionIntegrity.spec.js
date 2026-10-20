import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Transaction Integrity", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-070: Checkout transaction rollback — mid-process failure leaves no partial records", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-070", "Checkout transaction rollback — mid-process failure leaves no partial records", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-070",
        title: "Checkout transaction rollback — mid-process failure leaves no partial records",
        file: "database/transactionIntegrity.test.js",
        testName: "Checkout transaction rollback — mid-process failure leaves no partial records",
        runner: "jest",
        slug: "transaction-integrity",
      });
    });
  });

  test("ODB-UX-071: Checkout transaction commit — successful checkout updates inventory and cart atomically", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-071", "Checkout transaction commit — successful checkout updates inventory and cart atomically", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-071",
        title: "Checkout transaction commit — successful checkout updates inventory and cart atomically",
        file: "database/transactionIntegrity.test.js",
        testName: "Checkout transaction commit — successful checkout updates inventory and cart atomically",
        runner: "jest",
        slug: "transaction-integrity",
      });
    });
  });
});
