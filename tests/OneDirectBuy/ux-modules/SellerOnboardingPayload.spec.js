import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Seller Onboarding Payload", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-051: buildPublicSellerApplicationBody maps wizard fields and pending lifecycle", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-051", "buildPublicSellerApplicationBody maps wizard fields and pending lifecycle", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-051",
        title: "buildPublicSellerApplicationBody maps wizard fields and pending lifecycle",
        file: "sellers/sellerOnboardingPayload.test.js",
        testName: "buildPublicSellerApplicationBody maps wizard fields and pending lifecycle",
        runner: "jest",
        slug: "seller-onboarding-payload",
      });
    });
  });

  test("ODB-UX-052: buildPublicSellerApplicationBody preserves minimal storefront pipeline version", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-052", "buildPublicSellerApplicationBody preserves minimal storefront pipeline version", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-052",
        title: "buildPublicSellerApplicationBody preserves minimal storefront pipeline version",
        file: "sellers/sellerOnboardingPayload.test.js",
        testName: "buildPublicSellerApplicationBody preserves minimal storefront pipeline version",
        runner: "jest",
        slug: "seller-onboarding-payload",
      });
    });
  });

  test("ODB-UX-053: buildSellerPayloadFromWizard keeps admin create defaults", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-053", "buildSellerPayloadFromWizard keeps admin create defaults", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-053",
        title: "buildSellerPayloadFromWizard keeps admin create defaults",
        file: "sellers/sellerOnboardingPayload.test.js",
        testName: "buildSellerPayloadFromWizard keeps admin create defaults",
        runner: "jest",
        slug: "seller-onboarding-payload",
      });
    });
  });
});
