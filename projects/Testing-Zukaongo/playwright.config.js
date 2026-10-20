// @ts-check
import path from "path";
import { config as loadDotenv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/**
 * Environment variables are loaded from `.env` here and again in global-setup.cjs.
 * Shared helpers live under lib/ (env, logger, constants, cleanup).
 * See `.env.example`.
 */
loadDotenv({ path: path.resolve(process.cwd(), ".env") });

if (process.env.API_TOKEN && !process.env.REPORT_UPLOAD_AUTH_TOKEN) {
  process.env.REPORT_UPLOAD_AUTH_TOKEN = process.env.API_TOKEN;
}
if (process.env.API_URL && !process.env.REPORT_API_URL) {
  process.env.REPORT_API_URL = process.env.API_URL;
}

const ci = Boolean(process.env.CI);
const testEnv = (
  process.env.TEST_ENV || (ci ? "ci" : "local")
).toLowerCase();

/**
 * Unique report folder per run: playwright-report/YYYY-MM-DD_HH-mm-ss
 */
const reportTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const reportOutputDir = path.join("playwright-report", reportTimestamp);
const uiAnalysisOutputDir = path.join(
  "test-results",
  "ui-analysis",
  reportTimestamp,
);
const jsonReportPath = path.join("test-results", "results.json");
const junitReportPath = path.join("test-results", "junit.xml");

process.env.PW_REPORT_OUTPUT_DIR = reportOutputDir;
process.env.UI_ANALYSIS_DIR = uiAnalysisOutputDir;
process.env.PW_UI_ANALYSIS_OUTPUT_DIR = uiAnalysisOutputDir;
process.env.PW_JSON_REPORT_PATH = jsonReportPath;
process.env.PW_JUNIT_REPORT_PATH = junitReportPath;
/** Theme audit findings (JSON + HTML) for the ui-audit specs. */
process.env.ZUKA_UI_AUDIT_DIR =
  process.env.ZUKA_UI_AUDIT_DIR ||
  path.join("test-results", "zuka-ui-audit", reportTimestamp);

/**
 * - PW_HEADED=1 / HEADLESS=false → headed
 * - PW_HEADLESS=1 / HEADLESS=true → headless
 * - CI always runs headless unless PW_HEADED=1
 */
const headedFlag =
  process.env.PW_HEADED === "1" || process.env.PW_HEADED === "true";
const headlessFlag =
  process.env.PW_HEADLESS === "1" ||
  process.env.PW_HEADLESS === "true" ||
  process.env.HEADLESS === "1" ||
  process.env.HEADLESS === "true";
const useHeadless = headedFlag ? false : headlessFlag ? true : ci;

/** Default 1 worker: specs share live test accounts and orders. */
const workers =
  process.env.PW_WORKERS !== undefined && process.env.PW_WORKERS !== ""
    ? Number(process.env.PW_WORKERS) || 1
    : 1;

const retries =
  process.env.PW_RETRIES !== undefined
    ? Number(process.env.PW_RETRIES) || 0
    : ci
      ? 1
      : 0;

console.log(
  `[config] env=${testEnv} ci=${ci} headless=${useHeadless} workers=${workers} retries=${retries}`,
);

export default defineConfig({
  globalSetup: "./global-setup.cjs",
  testDir: "./tests",
  outputDir: "test-results",
  timeout: 300000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: !!ci,
  retries,
  workers,
  reporter: [
    ["list"],
    ["html", { outputFolder: reportOutputDir, open: "never" }],
    ["json", { outputFile: jsonReportPath }],
    ["junit", { outputFile: junitReportPath }],
    ["./reporters/devIssuesReporter.js"],
    ...(process.env.UI_ANALYSIS === "1" || process.env.UI_ANALYSIS === "true"
      ? [["./reporters/uiAnalysisReporter.js"]]
      : []),
    ...(process.env.REPORT_UPLOAD === "1" || process.env.REPORT_UPLOAD === "true"
      ? [["./reporters/uploadReporter.js"]]
      : []),
  ],
  use: {
    baseURL: process.env.ZUKA_CUSTOMER_URL || "https://zukaongo.com",
    headless: useHeadless,
    launchOptions:
      testEnv === "production"
        ? { args: ["--disable-dev-shm-usage"] }
        : undefined,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    screenshot: "only-on-failure",
    video:
      process.env.PW_VIDEO === "0" || testEnv === "production"
        ? "off"
        : "retain-on-failure",
    trace: testEnv === "production" ? "off" : "retain-on-failure",
    ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === "1",
    /* Grand Cayman: the customer app and partner app ask for location. */
    geolocation: { latitude: 19.3133, longitude: -81.3857 },
    permissions: ["geolocation"],
    timezoneId: "America/Cayman",
    locale: "en-US",
  },

  /* ZUKAongo only. CI uses Playwright Chromium; local keeps Google Chrome when available. */
  projects: [
    {
      name: "zukaongo",
      testDir: "./tests/Zukaongo",
      use: {
        ...devices["Desktop Chrome"],
        ...(ci || process.env.PW_USE_CHROME === "0"
          ? {}
          : { channel: "chrome" }),
        geolocation: { latitude: 19.3133, longitude: -81.3857 },
        permissions: ["geolocation"],
      },
    },
  ],
});
