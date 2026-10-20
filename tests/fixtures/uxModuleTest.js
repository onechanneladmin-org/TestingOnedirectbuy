/**
 * UX module Playwright fixture: soft() step reporting + screenshot capture
 * for UI analysis. Headed runs use the same fixture (PW_HEADED / dashboard checkbox).
 */
import { test as base } from "../helpers/softTest.js";
import { createStepCapture } from "../helpers/uiCapture.js";

export const test = base.extend({
  uxCapture: async ({ page }, use, testInfo) => {
    await use(createStepCapture(page, testInfo));
  },
  captureStep: async ({ uxCapture }, use) => {
    await use(uxCapture.captureStep);
  },
  _autoUxScreenshot: [
    async ({ uxCapture }, use) => {
      await use();
      if (uxCapture.getCaptureCount() === 0) {
        await uxCapture.captureStep("UX UI validation", async () => {}).catch(() => {});
      }
    },
    { auto: true },
  ],
});

export { expect, MARKERS } from "../helpers/softTest.js";
