import { test } from "../../fixtures/uxModuleTest.js";
import { backendSkipReason } from "../../helpers/uxModules.js";
import { runUxValidatedCase } from "../../helpers/uxUi.js";

test.describe("UX Modules — Verify reCAPTCHA", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-057: assertHoneypotClean rejects filled honeypot", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-057", "assertHoneypotClean rejects filled honeypot", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-057",
        title: "assertHoneypotClean rejects filled honeypot",
        file: "recaptcha/verifyRecaptcha.test.js",
        testName: "assertHoneypotClean rejects filled honeypot",
        runner: "jest",
        slug: "verify-recaptcha",
      });
    });
  });

  test("ODB-UX-058: assertHumanTiming rejects too-fast submit", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-058", "assertHumanTiming rejects too-fast submit", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-058",
        title: "assertHumanTiming rejects too-fast submit",
        file: "recaptcha/verifyRecaptcha.test.js",
        testName: "assertHumanTiming rejects too-fast submit",
        runner: "jest",
        slug: "verify-recaptcha",
      });
    });
  });

  test("ODB-UX-059: verifyRecaptchaToken skips when bypass enabled and no secret", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-059", "verifyRecaptchaToken skips when bypass enabled and no secret", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-059",
        title: "verifyRecaptchaToken skips when bypass enabled and no secret",
        file: "recaptcha/verifyRecaptcha.test.js",
        testName: "verifyRecaptchaToken skips when bypass enabled and no secret",
        runner: "jest",
        slug: "verify-recaptcha",
      });
    });
  });

  test("ODB-UX-060: isRecaptchaEnforced when secret is set", async ({ page, soft, captureStep }) => {
    await soft("ODB-UX-060", "isRecaptchaEnforced when secret is set", async () => {
      await runUxValidatedCase(page, captureStep, {
        id: "ODB-UX-060",
        title: "isRecaptchaEnforced when secret is set",
        file: "recaptcha/verifyRecaptcha.test.js",
        testName: "isRecaptchaEnforced when secret is set",
        runner: "jest",
        slug: "verify-recaptcha",
      });
    });
  });
});
