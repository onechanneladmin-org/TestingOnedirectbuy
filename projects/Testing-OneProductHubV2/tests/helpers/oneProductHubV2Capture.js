import { createStepCapture } from "./uiCapture.js";

const CAPTURE_KEY = Symbol.for("ophV2Capture");

/**
 * Error / warning patterns scanned from visible page text after each capture.
 */
const ISSUE_PATTERNS = [
  {
    id: "failed-to-fetch",
    severity: "critical",
    pattern: /failed to fetch|net::ERR_|ERR_CONNECTION_REFUSED/i,
    title: "Network / API failure visible in UI",
    suggestion:
      "Check API base URL (production should not call localhost). Verify backend health and CORS.",
  },
  {
    id: "auth-error",
    severity: "major",
    pattern:
      /invalid (email|password)|wrong password|authentication failed|user not found/i,
    title: "Authentication error shown to user",
    suggestion: "Confirm credentials, Firebase config, and error messaging copy.",
  },
  {
    id: "access-denied",
    severity: "major",
    pattern:
      /access denied|not authorized|unauthorized|forbidden|do not have access/i,
    title: "Access denied / authorization message",
    suggestion: "Verify RBAC permissions and role gates for this route.",
  },
  {
    id: "something-went-wrong",
    severity: "critical",
    pattern:
      /something went wrong|unexpected error|internal server error|http\s*500|error\s*500|status\s*500/i,
    title: "Unhandled application error message",
    suggestion: "Inspect browser console and backend logs for the failing request.",
  },
  {
    id: "not-found",
    severity: "minor",
    pattern: /page not found|\b404\b/i,
    title: "Empty / not-found state",
    suggestion: "Confirm seed data and empty-state UX if this was unexpected.",
  },
];

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 */
export function bindCaptureToPage(page, testInfo) {
  const { captureStep, getCaptureCount } = createStepCapture(page, testInfo);
  const ctx = { captureStep, getCaptureCount, issues: [], testInfo };
  page[CAPTURE_KEY] = ctx;
  return ctx;
}

/**
 * @param {import('@playwright/test').Page} page
 */
export function getCaptureContext(page) {
  return page?.[CAPTURE_KEY] || null;
}

/**
 * Capture screenshot + page data after opening a page or modal.
 * No-ops if the V2 capture fixture is not active on this page.
 * @param {import('@playwright/test').Page} page
 * @param {string} stepName
 */
export async function capturePageOrModal(page, stepName) {
  const ctx = getCaptureContext(page);
  if (!ctx?.captureStep) return null;

  await page.waitForTimeout(300).catch(() => {});

  const metadata = await ctx.captureStep(stepName, async () => {});
  const found = detectIssuesFromCapture(metadata, stepName);
  if (found.length) ctx.issues.push(...found);

  const modal = page.locator('[role="dialog"], [role="alertdialog"]').first();
  const modalVisible = await modal.isVisible().catch(() => false);
  if (modalVisible) {
    const modalMeta = await ctx.captureStep(`${stepName} — modal`, async () => {});
    const modalIssues = detectIssuesFromCapture(modalMeta, `${stepName} — modal`);
    if (modalIssues.length) ctx.issues.push(...modalIssues);
  }

  return metadata;
}

/**
 * @param {object} metadata
 * @param {string} stepName
 */
export function detectIssuesFromCapture(metadata, stepName) {
  /** @type {Array<object>} */
  const issues = [];
  if (!metadata) return issues;

  const pageData = metadata.pageData || {};
  const alerts = Array.isArray(pageData.alerts) ? pageData.alerts.join(" ") : "";
  const mainText = String(pageData.mainText || "");
  const haystack = `${alerts}\n${mainText}`;

  for (const rule of ISSUE_PATTERNS) {
    if (rule.pattern.test(haystack)) {
      issues.push({
        source: "ui-scan",
        severity: rule.severity,
        id: rule.id,
        title: rule.title,
        step: stepName,
        testFile: metadata.testFile,
        testTitle: metadata.testTitle,
        url: metadata.url,
        screenshotPath: metadata.screenshotPath,
        evidence: haystack.match(rule.pattern)?.[0] || "",
        suggestion: rule.suggestion,
        capturedAt: metadata.capturedAt,
      });
    }
  }

  return issues;
}

/**
 * @param {import('@playwright/test').Page} page
 */
export function drainCapturedIssues(page) {
  const ctx = getCaptureContext(page);
  if (!ctx) return [];
  const copy = [...ctx.issues];
  ctx.issues.length = 0;
  return copy;
}
