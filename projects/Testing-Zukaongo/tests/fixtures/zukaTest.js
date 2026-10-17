import { test as base, expect } from "@playwright/test";
import fs from "fs/promises";
import path from "path";
import {
  bindCaptureToPage,
  drainCapturedIssues,
  capturePageOrModal,
  getCaptureContext,
} from "../helpers/zukaCapture.js";
import { createSoftChecker, MARKERS } from "../helpers/softCheck.js";
import { trackApiSession } from "../helpers/zukaApi.js";
import { signIn } from "../helpers/zukaAuth.js";

const ISSUES_BUFFER_DIR = path.join("test-results", "dev-issues", "_buffer");

/**
 * ZUKAongo fixture: screenshots after pages/modals + buffers UI issues for the
 * developer issues reporter + soft() step markers for the flow control UI.
 * `rolePage(account)` opens extra signed-in contexts for multi-actor flows
 * (customer + kitchen + driver in one test); they are closed after the test.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    trackApiSession(page);
    const store = bindCaptureToPage(page, testInfo);
    await use(page);

    const failed = testInfo.status !== testInfo.expectedStatus;
    if (failed) {
      await capturePageOrModal(page, "Failure state").catch(() => {});
    } else if (store.getCaptureCount() === 0) {
      await capturePageOrModal(page, "Final state").catch(() => {});
    }

    const issues = drainCapturedIssues(page);
    if (failed) {
      issues.push({
        source: "test-failure",
        severity: "critical",
        id: "test-failed",
        title: `Test failed: ${testInfo.title}`,
        step: "test",
        testFile: testInfo.file,
        testTitle: testInfo.title,
        url: page.url(),
        screenshotPath: "",
        evidence: testInfo.error?.message || String(testInfo.status),
        suggestion:
          "Reproduce with the attached screenshots, fix the failing assertion or product bug, then re-run this spec.",
        capturedAt: new Date().toISOString(),
      });
    }

    if (issues.length) {
      await fs.mkdir(ISSUES_BUFFER_DIR, { recursive: true });
      const safe = testInfo.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 60);
      const out = path.join(ISSUES_BUFFER_DIR, `${Date.now()}-${safe || "test"}.json`);
      await fs.writeFile(
        out,
        JSON.stringify(
          {
            testFile: path.relative(process.cwd(), testInfo.file),
            testTitle: testInfo.title,
            status: testInfo.status,
            issues,
          },
          null,
          2,
        ),
        "utf8",
      );
    }
  },

  soft: async ({ page }, use, testInfo) => {
    const checker = createSoftChecker(page, testInfo);
    await use(checker.soft);
    checker.flush();
  },

  captureStep: async ({ page }, use) => {
    await use(async (stepName, fn) => {
      await fn();
      return capturePageOrModal(page, stepName);
    });
  },

  rolePage: async ({ browser }, use, testInfo) => {
    /** @type {Array<{ context: import('@playwright/test').BrowserContext; page: import('@playwright/test').Page; key: string }>} */
    const opened = [];
    await use(async (accountKey, opts = {}) => {
      const context = await browser.newContext({
        viewport: opts.viewport || { width: 1366, height: 900 },
        geolocation: { latitude: 19.2958, longitude: -81.3812 },
        permissions: ["geolocation"],
        timezoneId: "America/Cayman",
      });
      const page = await context.newPage();
      trackApiSession(page);
      opened.push({ context, page, key: accountKey });
      await signIn(page, accountKey);
      return page;
    });
    for (const { context, page, key } of opened) {
      if (testInfo.status !== testInfo.expectedStatus) {
        const shot = testInfo.outputPath(`role-${key}-failure.png`);
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
        await testInfo.attach(`${key} at failure`, { path: shot, contentType: "image/png" }).catch(() => {});
      }
      await context.close().catch(() => {});
    }
  },
});

export { expect, capturePageOrModal, getCaptureContext, MARKERS };
