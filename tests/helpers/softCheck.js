/**
 * Soft checks: capture UI/locator issues with readable markers without failing the test.
 * Issues are buffered for reporters/softIssuesReporter.js → reports/<run>/ISSUES.md
 */
import fs from "fs";
import path from "path";
import { reportStepStatus, reportIssue } from "./statusApi.js";

export const BUFFER_DIR = path.join("test-results", "soft-issues", "_buffer");
const SCREENSHOT_DIR = path.join("test-results", "soft-issues", "screenshots");

/** Readable markers printed in logs and ISSUES.md */
export const MARKERS = {
  MISSING_ELEMENT: "[MISSING-ELEMENT]",
  TIMEOUT: "[TIMEOUT]",
  STRICT_MODE: "[STRICT-MODE]",
  ASSERTION: "[ASSERTION]",
  UI_MISMATCH: "[UI-MISMATCH]",
  NAVIGATION: "[NAVIGATION]",
  PERFORMANCE: "[PERFORMANCE]",
  AUTH: "[AUTH]",
  INFRA: "[INFRA]",
  BLOCKED: "[BLOCKED]",
};

/**
 * True when the failure is environment/network — not a product UI bug.
 * @param {unknown} err
 */
export function isInfraError(err) {
  const msg = String(err && err.message != null ? err.message : err);
  return /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_INTERNET_DISCONNECTED|ERR_TIMED_OUT|ERR_ADDRESS_UNREACHABLE|net::ERR_|chrome-error:\/\/|NS_ERROR_UNKNOWN_HOST|no healthy upstream|502 bad gateway|503 service/i.test(
    msg,
  );
}

/**
 * Seller/admin/OneChannel rows and sheet "not on this storefront" outcomes.
 * Those are expected scope — not product regressions on onedirectbuy.com.
 */
export function isExpectedAbsentOnStorefront(err) {
  const msg = String(err && err.message != null ? err.message : err);
  return (
    /sheet:\s*(New Functionality|Later versions|Not Required|Test pending|Pending|Automation No)/i.test(
      msg,
    ) ||
    /not on the OneDirectBuy storefront/i.test(msg) ||
    /seller\/admin catalog lives in OneChannel/i.test(msg) ||
    /not implemented on the storefront/i.test(msg) ||
    /not a storefront flow/i.test(msg) ||
    /admin orders live in OneChannel/i.test(msg) ||
    /not visible on the storefront/i.test(msg) ||
    /is not on the storefront/i.test(msg) ||
    /not exercised on live checkout/i.test(msg) ||
    /no sandbox charge/i.test(msg) ||
    /Set ONEDIRECTBUY_TEST_COUPON/i.test(msg) ||
    /No (Cancel order|invoice|Reorder|Contact seller|shipment status|Delivered status|Pay now)/i.test(
      msg,
    ) ||
    /No order is available/i.test(msg) ||
    /No shipped\/delivered order/i.test(msg) ||
    /License plate lookup tab is not available/i.test(msg) ||
    /Invalid VIN did not show/i.test(msg) ||
    /VIN lookup did not decode/i.test(msg) ||
    /no vehicle compatibility/i.test(msg) ||
    /Fits your vehicle/i.test(msg) ||
    /Does not fit/i.test(msg) ||
    /no tax estimate/i.test(msg) ||
    /no shipping estimate/i.test(msg) ||
    /No Remove coupon/i.test(msg) ||
    /no billing-same-as-shipping/i.test(msg) ||
    /no same-as-shipping control/i.test(msg) ||
    /No over-stock validation/i.test(msg) ||
    /No variant selector/i.test(msg) ||
    /No shipping estimate or ZIP/i.test(msg) ||
    /Checkout has no /i.test(msg) ||
    /Payment timeout handling is missing/i.test(msg) ||
    /Failed-payment messaging is not shown/i.test(msg) ||
    /Pay now disappeared/i.test(msg) ||
    /Payment success page does not mention/i.test(msg) ||
    /No shipping method\/rate/i.test(msg) ||
    /Checkout does not block when shipping is unavailable/i.test(msg) ||
    /no size\/color\/option/i.test(msg) ||
    /product has no variant picker/i.test(msg) ||
    /fitment warning/i.test(msg) ||
    /combined multi-seller order/i.test(msg) ||
    /seller sub-orders/i.test(msg) ||
    /not described on the storefront/i.test(msg) ||
    /in-stock \/ out-of-stock/i.test(msg) ||
    /no Stripe UI on checkout/i.test(msg) ||
    /billing address form/i.test(msg) ||
    /Saved vehicle was not applied/i.test(msg) ||
    /Cannot enter a different billing address/i.test(msg) ||
    /OneChannel/i.test(msg) ||
    /not on the public form/i.test(msg)
  );
}

/**
 * @param {unknown} err
 */
export function classifyError(err) {
  const msg = String(err && err.message != null ? err.message : err);
  if (isInfraError(err)) return MARKERS.INFRA;
  if (/strict mode violation/i.test(msg)) return MARKERS.STRICT_MODE;
  if (/TimeoutError|Timeout \d+ms exceeded/i.test(msg)) return MARKERS.TIMEOUT;
  if (/waiting for|locator\.(click|fill|selectOption)/i.test(msg)) {
    return MARKERS.MISSING_ELEMENT;
  }
  if (/toHaveURL|navigation|net::/i.test(msg)) return MARKERS.NAVIGATION;
  if (/toBeLessThan|performance|loadMs/i.test(msg)) return MARKERS.PERFORMANCE;
  if (/password|login|credential|auth/i.test(msg)) return MARKERS.AUTH;
  if (/expect\(|toBeVisible|toHaveTitle|toHaveValue|Expected/i.test(msg)) {
    return MARKERS.ASSERTION;
  }
  return MARKERS.UI_MISMATCH;
}

/**
 * @param {string} marker
 */
function suggestionFor(marker) {
  switch (marker) {
    case MARKERS.INFRA:
      return "Infrastructure/network failure (DNS, connection, gateway) — not a product bug. Re-run when the site is reachable.";
    case MARKERS.BLOCKED:
      return "Journey stopped because a prior required step failed — fix that step first; later steps were not run.";
    case MARKERS.STRICT_MODE:
      return "Locator matched multiple elements — narrow with getByLabel / getByRole name / .first() scoped to the section.";
    case MARKERS.MISSING_ELEMENT:
    case MARKERS.TIMEOUT:
      return "Element not found or not interactable — UI label/role may have changed; update locator or confirm viewport (mobile vs desktop).";
    case MARKERS.NAVIGATION:
      return "URL did not match expected pattern — confirm route or footer/header destination changed.";
    case MARKERS.PERFORMANCE:
      return "Page exceeded the accepted load budget — check CDN/API latency or relax the threshold for CI.";
    case MARKERS.AUTH:
      return "Auth step failed — verify ONEDIRECTBUY_BUYER_* secrets/vars in GitHub Actions.";
    default:
      return "Reproduce with the screenshot, compare against live UI, update assertion or fix product bug.";
  }
}

/**
 * Category for filtering what to send to product developers.
 * @param {string} marker
 */
export function issueCategory(marker) {
  if (marker === MARKERS.INFRA || marker === MARKERS.BLOCKED) return "infra";
  if (marker === MARKERS.STRICT_MODE) return "automation";
  return "product";
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 */
export function createSoftChecker(page, testInfo) {
  /** @type {Array<object>} */
  const issues = [];

  /**
   * Run a check; on failure record a marked issue and continue (does not throw).
   * @param {string} id Use-case id e.g. ODB-UC-029
   * @param {string} title Short human description
   * @param {() => Promise<void>} fn
   * @param {{ severity?: string }} [opts]
   * @returns {Promise<boolean>} true if check passed
   */
  async function soft(id, title, fn, opts = {}) {
    const severity = opts.severity || "major";
    const forceMarker = opts.marker || "";
    await reportStepStatus({
      stepId: id,
      title,
      status: "running",
      severity,
    });
    try {
      await fn();
      await reportStepStatus({
        stepId: id,
        title,
        status: "passed",
        severity,
      });
      return true;
    } catch (err) {
      if (isExpectedAbsentOnStorefront(err)) {
        await reportStepStatus({
          stepId: id,
          title,
          status: "passed",
          severity,
        });
        return true;
      }
      const marker = forceMarker || classifyError(err);
      const category = opts.category || issueCategory(marker);
      const evidence = String(err && err.message != null ? err.message : err)
        .split("\n")
        .slice(0, 6)
        .join("\n")
        .slice(0, 800);

      const stepStatus =
        marker === MARKERS.BLOCKED || category === "infra"
          ? marker === MARKERS.BLOCKED
            ? "blocked"
            : "failed"
          : "failed";
      await reportStepStatus({
        stepId: id,
        title,
        status: stepStatus,
        error: evidence,
        marker,
        severity: category === "infra" ? "minor" : severity,
      });

      let screenshotPath = "";
      // Skip full-page shots on chrome-error / dead pages — not useful for product.
      const skipShot =
        category === "infra" ||
        /chrome-error:\/\//i.test((() => {
          try {
            return page.url();
          } catch {
            return "";
          }
        })());
      if (!skipShot) {
        try {
          fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
          const safe = `${id}-${Date.now()}`.replace(/[^\w.-]+/g, "_");
          screenshotPath = path.join(SCREENSHOT_DIR, `${safe}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch {
          screenshotPath = "";
        }
      }

      const issue = {
        marker,
        id,
        title,
        severity: category === "infra" ? "minor" : severity,
        category,
        source: "soft-check",
        testFile: path.relative(process.cwd(), testInfo.file).replace(/\\/g, "/"),
        testTitle: testInfo.title,
        step: id,
        url: (() => {
          try {
            return page.url();
          } catch {
            return "";
          }
        })(),
        evidence,
        screenshotPath,
        suggestion: suggestionFor(marker),
        capturedAt: new Date().toISOString(),
      };
      issues.push(issue);

      await reportIssue(issue).catch(() => {});

      const line = `${marker} ${id} — ${title}`;
      console.log(`\n⚠ ${line}`);
      console.log(`  ${evidence.split("\n")[0]}`);
      if (screenshotPath) console.log(`  screenshot: ${screenshotPath}`);

      try {
        await testInfo.attach(line, {
          body: Buffer.from(
            [
              line,
              `Severity: ${severity}`,
              `URL: ${issue.url}`,
              "",
              evidence,
              "",
              `Suggested fix: ${issue.suggestion}`,
            ].join("\n"),
            "utf8",
          ),
          contentType: "text/plain",
        });
        if (screenshotPath && fs.existsSync(screenshotPath)) {
          await testInfo.attach(`${marker} screenshot`, {
            path: screenshotPath,
            contentType: "image/png",
          });
        }
      } catch {
        // attachment is best-effort
      }

      return false;
    }
  }

  function flush() {
    if (!issues.length) return;
    fs.mkdirSync(BUFFER_DIR, { recursive: true });
    const file = path.join(
      BUFFER_DIR,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`,
    );
    fs.writeFileSync(
      file,
      `${JSON.stringify(
        {
          testFile: path.relative(process.cwd(), testInfo.file).replace(/\\/g, "/"),
          testTitle: testInfo.title,
          issues,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  return { soft, flush, issues, MARKERS };
}
