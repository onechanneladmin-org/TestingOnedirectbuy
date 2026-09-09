/**
 * Run Playwright tests selected by a config file and collect reports under reports/.
 *
 * Configs:
 *   flows.config.json — local `npm run test:flow` (toggle flows by id/name)
 *
 * Usage:
 *   node scripts/run-ci-tests.js [suite]
 *   CI_TESTS_CONFIG=flows.config.json node scripts/run-ci-tests.js
 *   CI_TESTS_CONFIG=flows.config.json node scripts/run-ci-tests.js flow:1
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(
  ROOT,
  process.env.CI_TESTS_CONFIG || "flows.config.json",
);

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config not found: ${CONFIG_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

/** Deduplicate while preserving order. */
function uniqueFiles(files) {
  const seen = new Set();
  const out = [];
  for (const file of files) {
    const key = file.replace(/\\/g, "/");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * flows.config.json — select by enabled flows (or all / single flow id).
 * Suite examples: regression | all | flow:3 | flow:Smoke
 */
function resolveFlowTestFiles(config, suite) {
  const flows = config.flows || [];
  const suiteKey = (
    suite ||
    process.env.CI_TEST_SUITE ||
    "regression"
  ).toLowerCase();

  let selected = flows;

  if (suiteKey === "all") {
    selected = flows;
  } else if (suiteKey.startsWith("flow:")) {
    const token = suite.slice(5).trim();
    const byId = Number(token);
    selected = flows.filter((f) => {
      if (Number.isFinite(byId) && !Number.isNaN(byId)) {
        return Number(f.id) === byId || String(f.id) === token;
      }
      return (
        String(f.id) === token ||
        String(f.name || "")
          .toLowerCase()
          .includes(token.toLowerCase())
      );
    });
    if (selected.length === 0) {
      console.error(
        `No flow matched "${token}". Use flow:<id> or flow:<name substring>.`,
      );
      process.exit(1);
    }
  } else if (suiteKey === "smoke") {
    selected = flows.filter((f) => Number(f.id) === 1 || String(f.id) === "1");
  } else {
    selected = flows.filter((f) => f.enabled !== false);
  }

  const files = selected.flatMap((f) => f.tests || []);
  return { testFiles: uniqueFiles(files), selectedFlows: selected };
}

function resolveTestFiles(config, suite) {
  if (Array.isArray(config.flows) && config.flows.length > 0) {
    return resolveFlowTestFiles(config, suite);
  }
  console.error("Config must include flows[] array");
  process.exit(1);
}

function isSoftPassEnabled() {
  if (process.env.CI_SOFT_PASS === "0" || process.env.CI_SOFT_PASS === "false") {
    return false;
  }
  if (process.env.CI_SOFT_PASS === "1" || process.env.CI_SOFT_PASS === "true") {
    return true;
  }
  return false;
}

function countIssues(runDir) {
  const jsonPath = path.join(runDir, "ISSUES.json");
  if (!fs.existsSync(jsonPath)) return 0;
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    return Array.isArray(data.issues) ? data.issues.length : 0;
  } catch {
    return 0;
  }
}

function writeSummary(runDir, runId, { suite, testFiles, exitCode, softPass, configPath }) {
  let parsedResults = null;
  const resultsPath = path.join(runDir, "results.json");
  if (fs.existsSync(resultsPath)) {
    try {
      parsedResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    } catch {
      parsedResults = null;
    }
  }

  const htmlExists = fs.existsSync(path.join(runDir, "html", "index.html"));
  const issuesExists = fs.existsSync(path.join(runDir, "ISSUES.md"));
  const issueCount = countIssues(runDir);

  const summary = {
    runId,
    suite,
    timestamp: new Date().toISOString(),
    exitCode,
    softPass,
    effectiveExitCode: softPass ? 0 : exitCode,
    browser: "chromium",
    issueCount,
    config: path.relative(ROOT, configPath).replace(/\\/g, "/"),
    testFiles,
    reports: {
      directory: path.relative(ROOT, runDir).replace(/\\/g, "/"),
      html: htmlExists ? "html/index.html" : null,
      resultsJson: fs.existsSync(resultsPath) ? "results.json" : null,
      issues: issuesExists ? "ISSUES.md" : null,
    },
    stats: parsedResults?.stats ?? null,
  };

  fs.writeFileSync(
    path.join(runDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(ROOT, "reports", "latest.json"),
    `${JSON.stringify(
      {
        runId,
        path: `reports/${runId}`,
        timestamp: summary.timestamp,
        suite,
        exitCode: summary.effectiveExitCode,
        softPass,
        issueCount,
        browser: "chromium",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`\nReports collected in reports/${runId}/`);
  if (softPass) {
    console.log(
      `\nCI_SOFT_PASS=1 → exiting 0 (green). Review soft issues for marked UI findings.`,
    );
  }
}

function main() {
  const suite = process.argv[2] || process.env.CI_TEST_SUITE || "regression";
  const config = loadConfig();
  const { testFiles, selectedFlows } = resolveTestFiles(config, suite);
  const softPass = isSoftPassEnabled();

  if (testFiles.length === 0) {
    console.error(
      `No tests selected for suite "${suite}". Edit ${path.relative(ROOT, CONFIG_PATH)}.`,
    );
    process.exit(1);
  }

  console.log(`Config: ${path.relative(ROOT, CONFIG_PATH).replace(/\\/g, "/")}`);
  console.log(`Suite: ${suite}`);
  console.log(`Soft pass: ${softPass ? "ON" : "OFF"}`);
  if (selectedFlows && selectedFlows.length > 0) {
    console.log(`Flows (${selectedFlows.length}):`);
    for (const flow of selectedFlows) {
      const flag = flow.enabled === false ? "off" : "on";
      console.log(`  - Flow ${flow.id}: ${flow.name} [${flag}]`);
    }
  }
  console.log(`Running ${testFiles.length} test file(s):`);
  for (const file of testFiles) {
    console.log(`  - ${file}`);
  }

  const workers =
    process.env.PW_WORKERS !== undefined && process.env.PW_WORKERS !== ""
      ? process.env.PW_WORKERS
      : String(config.workers ?? 1);
  const retries =
    process.env.PW_RETRIES !== undefined && process.env.PW_RETRIES !== ""
      ? process.env.PW_RETRIES
      : config.retries !== undefined
        ? String(config.retries)
        : undefined;

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = path.join(ROOT, "reports", runId);
  fs.mkdirSync(path.join(runDir, "html"), { recursive: true });

  const env = {
    ...process.env,
    PW_WORKERS: workers,
    ...(retries !== undefined ? { PW_RETRIES: retries } : {}),
    CI_SOFT_PASS: softPass ? "1" : "0",
    PW_REPORT_OUTPUT_DIR: path.join("reports", runId, "html"),
    PW_JSON_REPORT_PATH: path.join("reports", runId, "results.json"),
    PW_JUNIT_REPORT_PATH: path.join("reports", runId, "junit.xml"),
  };

  if (process.env.RUNNING_OCCURRENCE_ID) {
    env.RUNNING_OCCURRENCE_ID = process.env.RUNNING_OCCURRENCE_ID;
  }
  if (process.env.STATUS_API_URL) {
    env.STATUS_API_URL = process.env.STATUS_API_URL;
  }
  if (process.env.MONGODB_URI) {
    env.MONGODB_URI = process.env.MONGODB_URI;
  }
  if (process.env.STATUS_API_TOKEN || process.env.API_TOKEN) {
    env.STATUS_API_TOKEN =
      process.env.STATUS_API_TOKEN || process.env.API_TOKEN;
  }

  console.log(
    `[run-ci] occurrence=${env.RUNNING_OCCURRENCE_ID || "(none)"} api=${env.STATUS_API_URL || "(none)"}`,
  );

  if (env.RUNNING_OCCURRENCE_ID) {
    const metaFile = path.join(ROOT, "reports", "oph-flow-run.json");
    const activeFile = path.join(ROOT, "reports", "oph-active-occurrence.txt");
    let prev = {};
    try {
      if (fs.existsSync(metaFile)) {
        prev = JSON.parse(fs.readFileSync(metaFile, "utf8"));
      }
    } catch {
      prev = {};
    }
    fs.mkdirSync(path.dirname(metaFile), { recursive: true });
    fs.writeFileSync(
      metaFile,
      `${JSON.stringify(
        {
          ...prev,
          occurrenceId: env.RUNNING_OCCURRENCE_ID,
          statusApiUrl: env.STATUS_API_URL || prev.statusApiUrl || "",
          mongoUri: env.MONGODB_URI || prev.mongoUri || "",
          refreshedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    fs.writeFileSync(activeFile, `${env.RUNNING_OCCURRENCE_ID}\n`, "utf8");
    console.log(`[run-ci] refreshed control-plane meta at ${metaFile}`);
  }

  // ProductHub project name (not chromium)
  const args = ["test", "--project=oneproducthub", ...testFiles];
  if (
    process.env.PW_HEADED === "1" ||
    process.env.PW_HEADED === "true" ||
    process.env.HEADLESS === "false" ||
    process.env.PW_HEADLESS === "0"
  ) {
    args.push("--headed");
  }

  const pwCli =
    process.env.PLAYWRIGHT_CLI_PATH ||
    path.join(ROOT, "node_modules", "@playwright", "test", "cli.js");
  if (!fs.existsSync(pwCli)) {
    console.error(`Playwright CLI not found: ${pwCli}`);
    process.exit(1);
  }

  console.log(`[run-ci] node ${path.relative(ROOT, pwCli)} ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [pwCli, ...args], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    windowsHide: false,
  });

  const playwrightExit = result.status ?? 1;
  writeSummary(runDir, runId, {
    suite,
    testFiles,
    exitCode: playwrightExit,
    softPass,
    configPath: CONFIG_PATH,
  });

  if (process.env.RUNNING_OCCURRENCE_ID) {
    process.exit(playwrightExit);
  }
  process.exit(softPass ? 0 : playwrightExit);
}

main();
