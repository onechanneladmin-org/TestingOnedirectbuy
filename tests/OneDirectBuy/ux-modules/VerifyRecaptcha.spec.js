import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("UX Modules — Verify reCAPTCHA", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

  test("ODB-UX-057: assertHoneypotClean rejects filled honeypot", async ({ soft }) => {
    await soft("ODB-UX-057", "assertHoneypotClean rejects filled honeypot", async () => {
      await runUxModuleCase({
        file: "recaptcha/verifyRecaptcha.test.js",
        testName: "assertHoneypotClean rejects filled honeypot",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-058: assertHumanTiming rejects too-fast submit", async ({ soft }) => {
    await soft("ODB-UX-058", "assertHumanTiming rejects too-fast submit", async () => {
      await runUxModuleCase({
        file: "recaptcha/verifyRecaptcha.test.js",
        testName: "assertHumanTiming rejects too-fast submit",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-059: verifyRecaptchaToken skips when bypass enabled and no secret", async ({ soft }) => {
    await soft("ODB-UX-059", "verifyRecaptchaToken skips when bypass enabled and no secret", async () => {
      await runUxModuleCase({
        file: "recaptcha/verifyRecaptcha.test.js",
        testName: "verifyRecaptchaToken skips when bypass enabled and no secret",
        runner: "jest",
      });
    });
  });

  test("ODB-UX-060: isRecaptchaEnforced when secret is set", async ({ soft }) => {
    await soft("ODB-UX-060", "isRecaptchaEnforced when secret is set", async () => {
      await runUxModuleCase({
        file: "recaptcha/verifyRecaptcha.test.js",
        testName: "isRecaptchaEnforced when secret is set",
        runner: "jest",
      });
    });
  });
});
