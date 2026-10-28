// Page health: collect console errors / uncaught exceptions / failed backend calls and detect
// error screens. Pure parts (classifiers) are unit-tested in page-health.test.js.

/** Text that means the page crashed or is missing (Next.js prod + dev overlays, our 404/500). */
const ERROR_SCREEN_PATTERNS = [
  /Application error: a client-side exception has occurred/i,
  /Unhandled Runtime Error/i,
  /Internal Server Error/i,
  /This page could not be found/i,
  /Sorry, we couldn.t find the page you are looking for/i, // src/pages/404.js
  /ChunkLoadError/i,
];

/**
 * Console noise that is not an app defect (third-party widgets, browser quirks). Keep this list
 * short and specific; every entry needs a reason. Add per-page exceptions in the spec, not here.
 */
const IGNORED_CONSOLE = [
  /ResizeObserver loop/i, // benign browser warning surfaced as error by some libs
  /Download the React DevTools/i,
  /favicon\.ico/i,
  /googletagmanager|google-analytics|clarity\.ms|hotjar|intercom|sentry\.io/i, // third-party beacons
  /Failed to load resource: net::ERR_BLOCKED_BY_CLIENT/i,
  /Abort fetching component for route/i, // Next.js: a router.replace superseded by the page's own redirect
  /report-only Content Security Policy/i, // report-only CSP notice (e.g. embedded google.com frame), nothing is blocked
];

function isIgnoredConsole(text) {
  return IGNORED_CONSOLE.some((re) => re.test(String(text || "")));
}

function findErrorScreen(bodyText) {
  const t = String(bodyText || "");
  const hit = ERROR_SCREEN_PATTERNS.find((re) => re.test(t));
  return hit ? String(hit) : null;
}

/** Attach listeners; returns a collector whose `.issues()` lists everything seen since `.reset()`. */
function watchPage(page) {
  let issues = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!isIgnoredConsole(text)) issues.push({ kind: "console", text: text.slice(0, 500) });
  });
  page.on("pageerror", (err) => {
    issues.push({ kind: "pageerror", text: String(err && err.message ? err.message : err).slice(0, 500) });
  });
  page.on("response", (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 500 && /onechanneladmin\.com|onedirectbuy\.com|localhost/i.test(url)) {
      issues.push({ kind: "http5xx", text: `${status} ${res.request().method()} ${url.split("?")[0]}` });
    }
  });
  return {
    reset() {
      issues = [];
    },
    issues() {
      return [...issues];
    },
  };
}

/**
 * Wait for a route to settle: network idle (bounded) and no spinner left. Admin pages poll, so
 * networkidle may never come — the timeout is a ceiling, not a failure.
 */
async function settle(page, { timeout = 15000 } = {}) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
  await page
    .locator(".p-progress-spinner, .p-datatable-loading-overlay")
    .first()
    .waitFor({ state: "detached", timeout })
    .catch(() => {});
}

module.exports = { ERROR_SCREEN_PATTERNS, IGNORED_CONSOLE, isIgnoredConsole, findErrorScreen, watchPage, settle };
