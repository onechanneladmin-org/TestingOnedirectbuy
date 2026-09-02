/**
 * Launcher for a single flow occurrence (opened in a visible terminal).
 * Reads reports/.odb-flow-run.json (or path arg), sets env, runs Playwright
 * in the selected project's directory.
 *
 * Usage: node scripts/run-flow-occurrence.js [metaPath]
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { META_PATH } = require("../lib/occurrenceLive");

const HUB_ROOT = path.resolve(__dirname, "..");

function playwrightCli(projectRoot) {
  return path.join(
    projectRoot,
    "node_modules",
    "@playwright",
    "test",
    "cli.js",
  );
}

function main() {
  const metaPath = path.resolve(process.argv[2] || META_PATH);
  if (!fs.existsSync(metaPath)) {
    console.error(`Missing run meta: ${metaPath}`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const flowId = meta.flowId;
  const occurrenceId = meta.occurrenceId;
  if (!flowId || !occurrenceId) {
    console.error("meta must include flowId and occurrenceId");
    process.exit(1);
  }

  const projectRoot = meta.projectRoot
    ? path.resolve(meta.projectRoot)
    : HUB_ROOT;
  const projectId = meta.projectId || "onedirectbuy";

  console.log(`\n=== Flow Control Plane runner ===`);
  console.log(`Project:    ${projectId}`);
  console.log(`Flow:       ${flowId}`);
  console.log(`Occurrence: ${occurrenceId}`);
  console.log(`Cwd:        ${projectRoot}`);
  console.log(
    `Mongo:      ${(meta.mongoUri || process.env.MONGODB_URI || "").replace(
      /:\/\/.*@/,
      "://***@",
    )}`,
  );
  console.log(`API:        ${meta.statusApiUrl || process.env.STATUS_API_URL || ""}`);
  console.log(`===============================\n`);

  if (!fs.existsSync(projectRoot)) {
    console.error(`Project folder not found: ${projectRoot}`);
    process.exit(1);
  }

  const env = {
    ...process.env,
    CI_TESTS_CONFIG: "flows.config.json",
    RUNNING_OCCURRENCE_ID: occurrenceId,
    STATUS_API_URL: meta.statusApiUrl || process.env.STATUS_API_URL || "",
    MONGODB_URI: meta.mongoUri || process.env.MONGODB_URI || "",
    // Always real exit for control-plane (UI must not fake PASSED)
    CI_SOFT_PASS: "0",
  };

  if (meta.headed) {
    env.PW_HEADED = "1";
    env.HEADLESS = "false";
    env.PW_HEADLESS = "0";
  } else {
    env.PW_HEADLESS = env.PW_HEADLESS || "1";
    env.HEADLESS = env.HEADLESS || "true";
  }

  if (meta.grep) {
    env.PW_GREP = meta.grep;
  }
  if (meta.workers) {
    env.PW_WORKERS = String(meta.workers);
  }

  const ciRunner = path.join(projectRoot, "scripts", "run-ci-tests.js");
  const useCiRunner =
    meta.runner !== "playwright" && fs.existsSync(ciRunner);

  let result;
  if (useCiRunner) {
    console.log(`Starting: node scripts/run-ci-tests.js flow:${flowId}\n`);
    if (meta.useCaseId) {
      console.log(`Use case: ${meta.useCaseId}`);
    }
    if (meta.grep) {
      console.log(`Grep:     ${meta.grep}`);
    }
    result = spawnSync(process.execPath, [ciRunner, `flow:${flowId}`], {
      cwd: projectRoot,
      env,
      stdio: "inherit",
      windowsHide: false,
    });
  } else {
    const tests = Array.isArray(meta.tests) ? meta.tests.filter(Boolean) : [];
    if (!tests.length) {
      console.error("No test files in meta.tests and no run-ci-tests.js");
      process.exit(1);
    }
    const pwCli = playwrightCli(projectRoot);
    if (!fs.existsSync(pwCli)) {
      console.error(`Playwright CLI not found: ${pwCli}`);
      console.error("Run npm install in that project folder first.");
      process.exit(1);
    }
    const args = ["test", ...tests];
    if (meta.headed) args.push("--headed");
    if (meta.grep) args.push("--grep", meta.grep);
    console.log(`Starting: playwright ${args.join(" ")}\n`);
    result = spawnSync(process.execPath, [pwCli, ...args], {
      cwd: projectRoot,
      env,
      stdio: "inherit",
      windowsHide: false,
    });
  }

  const code = result.status ?? 1;
  const exitFile =
    meta.exitFile ||
    path.join(HUB_ROOT, "reports", `.flow-exit-${occurrenceId}.txt`);
  try {
    fs.mkdirSync(path.dirname(exitFile), { recursive: true });
    fs.writeFileSync(exitFile, `${code}\n`, "utf8");
    console.log(`Wrote exit file: ${exitFile} → ${code}`);
  } catch (err) {
    console.error("Failed to write exit file:", err.message);
  }

  console.log(`\nFlow finished with exit code ${code}`);
  // Parent .cmd usually pauses; avoid double-pause unless asked
  if (
    process.platform === "win32" &&
    process.env.ODB_PAUSE_ON_EXIT === "1"
  ) {
    console.log("Press Enter to close this window…");
    try {
      require("child_process").spawnSync("pause", {
        shell: true,
        stdio: "inherit",
      });
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

main();
