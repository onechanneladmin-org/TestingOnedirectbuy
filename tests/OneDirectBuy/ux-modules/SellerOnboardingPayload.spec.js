import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Seller Onboarding Payload", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-051: buildPublicSellerApplicationBody maps wizard fields and pending lifecycle", async ({ soft }) => {
    await soft("ODB-UX-051", "buildPublicSellerApplicationBody maps wizard fields and pending lifecycle", async () => {
      await runUxModuleCase({
        file: "sellers/sellerOnboardingPayload.test.js",
        testName: "buildPublicSellerApplicationBody maps wizard fields and pending lifecycle",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-052: buildPublicSellerApplicationBody preserves minimal storefront pipeline version", async ({ soft }) => {
    await soft("ODB-UX-052", "buildPublicSellerApplicationBody preserves minimal storefront pipeline version", async () => {
      await runUxModuleCase({
        file: "sellers/sellerOnboardingPayload.test.js",
        testName: "buildPublicSellerApplicationBody preserves minimal storefront pipeline version",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-053: buildSellerPayloadFromWizard keeps admin create defaults", async ({ soft }) => {
    await soft("ODB-UX-053", "buildSellerPayloadFromWizard keeps admin create defaults", async () => {
      await runUxModuleCase({
        file: "sellers/sellerOnboardingPayload.test.js",
        testName: "buildSellerPayloadFromWizard keeps admin create defaults",
        runner: "jest",
      });
    });
  });
});
