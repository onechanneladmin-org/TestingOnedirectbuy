/**
 * Spawn Playwright for a flow, track occurrence in MongoDB.
 * On Windows, opens a NEW visible terminal window for the run.
 */
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { randomUUID } = require("crypto");
const Flow = require("../models/Flow");
const RunningOccurrence = require("../models/RunningOccurrence");
const Report = require("../models/Report");
const { ROOT, STATUS_API_URL, MONGODB_URI } = require("../config");
const {
  writeMeta,
  clearMeta,
  META_PATH,
} = require("../../lib/occurrenceLive");
const { grepUseCasePattern } = require("../lib/useCaseCatalog");
const {
  defaultProjectId,
  requireAvailableProject,
} = require("../lib/projects");
const {
  applyLiveStep,
  countCompleted,
  countTotal,
  skipIncomplete,
  rollupStatus,
} = require("../../lib/applyLiveStep");
const {
  sanitizePlaywrightBrowsersPath,
} = require("../../lib/playwrightBrowsers.cjs");

/** @type {Map<string, { timer?: NodeJS.Timeout }>} */
const activeWatchers = new Map();

function mapChildForOccurrence(c, i) {
  return {
    stepId: c.stepId,
    title: c.title || c.stepId,
    specFile: c.specFile || "",
    order: c.order ?? i + 1,
    dependsOn: c.dependsOn || null,
    status: "pending",
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    error: "",
    marker: "",
    severity: "",
  };
}

function mapParentForOccurrence(s) {
  const children = (s.children || []).map((c, i) => mapChildForOccurrence(c, i));
  return {
    stepId: s.stepId,
    title: s.title,
    specFile: s.specFile || "",
    status: "pending",
    order: s.order,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    error: "",
    marker: "",
    severity: "",
    module: s.module || "",
    actor: s.actor || "",
    useCase: s.useCase || "",
    description: s.description || "",
    priority: s.priority || "",
    automation: s.automation || "",
    currentStatus: s.currentStatus || "",
    children,
  };
}

/**
 * @param {string} flowId
 * @param {{ headed?: boolean; useCaseId?: string; projectId?: string }} [opts]
 */
async function startFlowRun(flowId, opts = {}) {
  const key = String(flowId);
  const projectId = String(opts.projectId || defaultProjectId()).trim();
  const project = requireAvailableProject(projectId);
  const flow = await Flow.findOne({ projectId, flowId: key });
  if (!flow) {
    const err = new Error(`Flow not found: ${key} (${projectId})`);
    err.status = 404;
    throw err;
  }
  const projectRoot = project.root;
  const hasCiRunner = fs.existsSync(
    path.join(projectRoot, "scripts", "run-ci-tests.js"),
  );

  const useCaseId = opts.useCaseId ? String(opts.useCaseId).trim() : "";
  let sourceSteps = flow.steps || [];
  if (useCaseId) {
    const parent = sourceSteps.find((s) => s.stepId === useCaseId);
    if (!parent) {
      const err = new Error(`Use case not found: ${useCaseId}`);
      err.status = 404;
      throw err;
    }
    sourceSteps = [parent];
  }

  const occurrenceId = randomUUID();
  const steps = sourceSteps.map((s) => mapParentForOccurrence(s));
  const grep = useCaseId ? grepUseCasePattern(useCaseId) : "";
  const serialWorkers = Boolean(flow.catalog || useCaseId);
  const flowName = useCaseId ? `${flow.name} · ${useCaseId}` : flow.name;

  const exitFile = path.join(ROOT, "reports", `.flow-exit-${occurrenceId}.txt`);
  try {
    if (fs.existsSync(exitFile)) fs.unlinkSync(exitFile);
  } catch {
    // ignore
  }

  const occurrence = await RunningOccurrence.create({
    occurrenceId,
    projectId,
    flowId: key,
    flowName,
    status: "queued",
    stepsCompleted: 0,
    stepsTotal: countTotal(steps),
    steps,
    liveIssues: [],
    liveIssueCount: 0,
    currentStepId: null,
    envSummary: {
      STATUS_API_URL,
      CI_TESTS_CONFIG: "flows.config.json",
      suite: useCaseId ? `flow:${key}:${useCaseId}` : `flow:${key}`,
      visibleTerminal: process.platform === "win32",
      useCaseId,
      grep,
      projectId,
      projectRoot,
      tests: flow.tests || [],
      runner: hasCiRunner ? "ci-tests" : "playwright",
    },
  });

  // Ensure empty live-step feed for this occurrence
  try {
    const liveDir = path.join(ROOT, "reports", "live-steps");
    fs.mkdirSync(liveDir, { recursive: true });
    fs.writeFileSync(path.join(liveDir, `${occurrenceId}.ndjson`), "", "utf8");
  } catch {
    // ignore
  }

  // Meta lives under reports/ (NOT test-results/) so Playwright cleanup cannot wipe it.
  writeMeta({
    occurrenceId,
    projectId,
    projectRoot,
    flowId: key,
    tests: flow.tests || [],
    runner: hasCiRunner ? "ci-tests" : "playwright",
    useCaseId,
    grep,
    workers: serialWorkers ? 1 : undefined,
    statusApiUrl: STATUS_API_URL,
    mongoUri: MONGODB_URI,
    headed: Boolean(opts.headed),
    // Control-plane runs must report real Playwright exit (not CI soft-pass)
    softPass: "0",
    exitFile: exitFile.replace(/\\/g, "/"),
    startedAt: new Date().toISOString(),
  });

  const launcher = path.join(ROOT, "scripts", "run-flow-occurrence.js");
  const useSmokeRunner = process.env.FLOW_SMOKE_RUNNER === "1";

  console.log(
    `[runFlow] starting project=${projectId} flow=${key}${useCaseId ? ` useCase=${useCaseId}` : ""} occurrence=${occurrenceId} cwd=${projectRoot} visible=${process.platform === "win32"}`,
  );

  occurrence.status = "running";
  occurrence.startedAt = new Date();

  if (useSmokeRunner) {
    const smoke = path.join(ROOT, "scripts", "smoke-fake-runner.js");
    const child = spawn(process.execPath, [smoke], {
      cwd: ROOT,
      env: {
        ...process.env,
        RUNNING_OCCURRENCE_ID: occurrenceId,
        STATUS_API_URL,
        MONGODB_URI,
        CI_SOFT_PASS: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: false,
    });
    occurrence.workerPid = child.pid;
    await occurrence.save();
    child.stdout?.on("data", (b) => process.stdout.write(b));
    child.stderr?.on("data", (b) => process.stderr.write(b));
    child.on("close", async (code) => {
      try {
        await finalizeOccurrence(occurrenceId, code ?? 1);
      } catch (err) {
        console.error("[runFlow] finalize failed:", err.message);
      }
    });
    return occurrence.toObject();
  }

  const uniqueMetaPath = path.join(
    ROOT,
    "reports",
    `odb-flow-run-${occurrenceId}.json`,
  );

  const isVisibleTerminal =
    opts.visibleTerminal !== undefined
      ? Boolean(opts.visibleTerminal)
      : process.platform === "win32" && process.env.FLOW_VISIBLE_TERMINAL !== "0";

  if (isVisibleTerminal) {
    // Reliable visible CMD: write a .cmd wrapper so `start` quoting cannot break,
    // env vars are explicit, and Playwright logs stream in that window.
    const batPath = path.join(ROOT, "reports", `flow-run-${occurrenceId}.cmd`);
    const logPath = path.join(ROOT, "reports", `flow-run-${occurrenceId}.log`);
    const projectCmd = projectRoot.replace(/\//g, "\\");
    const batPathCmd = batPath.replace(/\//g, "\\");
    const logPathCmd = logPath.replace(/\//g, "\\");
    const exitFileCmd = exitFile.replace(/\//g, "\\");
    const metaCmd = uniqueMetaPath.replace(/\//g, "\\");
    const launcherCmd = launcher.replace(/\//g, "\\");
    const nodeExe = process.execPath;
    const headedLines = opts.headed
      ? ["set PW_HEADED=1", "set HEADLESS=false", "set PW_HEADLESS=0"]
      : ["set PW_HEADLESS=1", "set HEADLESS=true"];
    const workerLines = serialWorkers ? ['set "PW_WORKERS=1"'] : [];
    const bat = [
      "@echo off",
      "setlocal EnableExtensions EnableDelayedExpansion",
      `title ${project.name} Flow ${key}${useCaseId ? ` ${useCaseId}` : ""} — ${occurrenceId.slice(0, 8)}`,
      `cd /d "${projectCmd}"`,
      `echo [%DATE% %TIME%] launcher start> "${logPathCmd}"`,
      `set "RUNNING_OCCURRENCE_ID=${occurrenceId}"`,
      `set "STATUS_API_URL=${STATUS_API_URL}"`,
      `set "MONGODB_URI=${MONGODB_URI}"`,
      'set "CI_SOFT_PASS=0"',
      'set "CI_TESTS_CONFIG=flows.config.json"',
      'set "ODB_PAUSE_ON_EXIT=0"',
      'set "PLAYWRIGHT_BROWSERS_PATH="',
      ...headedLines,
      ...workerLines,
      "echo.",
      "echo ============================================",
      "echo  Flow Control Plane — runner",
      `echo  Project:    ${project.name}`,
      `echo  Flow:       ${key}`,
      useCaseId ? `echo  Use case:   ${useCaseId}` : "echo.",
      `echo  Occurrence: ${occurrenceId}`,
      "echo  Dir:        %CD%",
      `echo  API:        ${STATUS_API_URL}`,
      "echo ============================================",
      "echo.",
      `echo [%DATE% %TIME%] running node>> "${logPathCmd}"`,
      `"${nodeExe}" "${launcherCmd}" "${metaCmd}" >> "${logPathCmd}" 2>&1`,
      "set EXITCODE=%ERRORLEVEL%",
      `>>"${logPathCmd}" echo [%DATE% %TIME%] node exit=!EXITCODE!`,
      `>"${exitFileCmd}" echo !EXITCODE!`,
      "echo.",
      "echo Flow finished with exit code !EXITCODE!",
      "echo Full log also saved to reports\\flow-run-*.log",
      'if not "%ODB_PAUSE_ON_EXIT%"=="0" echo Window stays open so you can read the log.',
      'if not "%ODB_PAUSE_ON_EXIT%"=="0" pause',
      "exit /b !EXITCODE!",
      "",
    ].join("\r\n");
    fs.writeFileSync(batPath, bat, "utf8");

    // shell:true + start "title" /D cwd — most reliable new-console spawn on Windows
    const startCmd = `start "${project.name} Flow ${key}" /D "${projectCmd}" cmd.exe /c "${batPathCmd}"`;
    console.log(`[runFlow] spawning visible terminal: ${startCmd}`);
    const childEnv = {
      ...process.env,
      RUNNING_OCCURRENCE_ID: occurrenceId,
      STATUS_API_URL,
      MONGODB_URI,
    };
    sanitizePlaywrightBrowsersPath(childEnv);
    const child = spawn(startCmd, {
      cwd: projectRoot,
      env: childEnv,
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      shell: true,
    });
    child.unref();
    occurrence.workerPid = child.pid;
    occurrence.envSummary = {
      ...occurrence.envSummary,
      batPath: path.relative(ROOT, batPath).replace(/\\/g, "/"),
      logPath: path.relative(ROOT, logPath).replace(/\\/g, "/"),
      headed: Boolean(opts.headed),
      useCaseId,
      grep,
      projectId,
      projectRoot,
    };
    await occurrence.save();
    watchExitFile(occurrenceId, exitFile);
  } else {
    const child = spawn(process.execPath, [launcher, uniqueMetaPath], {
      cwd: projectRoot,
      env: (() => {
        const childEnv = {
          ...process.env,
          RUNNING_OCCURRENCE_ID: occurrenceId,
          STATUS_API_URL,
          MONGODB_URI,
          ODB_PAUSE_ON_EXIT: "0",
          ...(serialWorkers ? { PW_WORKERS: "1" } : {}),
        };
        sanitizePlaywrightBrowsersPath(childEnv);
        return childEnv;
      })(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    occurrence.workerPid = child.pid;
    occurrence.envSummary = {
      ...occurrence.envSummary,
      headed: Boolean(opts.headed),
      useCaseId,
      grep,
      projectId,
      projectRoot,
    };
    await occurrence.save();
    child.stdout?.on("data", (b) => process.stdout.write(b));
    child.stderr?.on("data", (b) => process.stderr.write(b));
    child.on("close", async (code) => {
      try {
        await finalizeOccurrence(occurrenceId, code ?? 1);
      } catch (err) {
        console.error("[runFlow] finalize failed:", err.message);
      }
    });
    watchExitFile(occurrenceId, exitFile);
  }

  return occurrence.toObject();
}

function watchExitFile(occurrenceId, exitFile) {
  if (activeWatchers.has(occurrenceId)) return;
  const started = Date.now();
  const maxMs = 3 * 60 * 60 * 1000;
  const liveFile = path.join(ROOT, "reports", "live-steps", `${occurrenceId}.ndjson`);
  let liveOffset = 0;

  const timer = setInterval(async () => {
    try {
      // Ingest live step/issue events written by soft() (file feed)
      await ingestLiveStepFile(occurrenceId, liveFile, () => liveOffset, (n) => {
        liveOffset = n;
      });

      if (fs.existsSync(exitFile)) {
        const raw = fs.readFileSync(exitFile, "utf8").trim();
        const code = Number(raw);
        clearInterval(timer);
        activeWatchers.delete(occurrenceId);
        // Final ingest in case last events arrived with exit
        await ingestLiveStepFile(occurrenceId, liveFile, () => liveOffset, (n) => {
          liveOffset = n;
        });
        try {
          fs.unlinkSync(exitFile);
        } catch {
          // ignore
        }
        await finalizeOccurrence(
          occurrenceId,
          Number.isFinite(code) ? code : 1,
        );
        return;
      }
      if (Date.now() - started > maxMs) {
        clearInterval(timer);
        activeWatchers.delete(occurrenceId);
        await finalizeOccurrence(occurrenceId, 1);
      }
    } catch (err) {
      console.error("[runFlow] exit watcher error:", err.message);
    }
  }, 750);
  activeWatchers.set(occurrenceId, { timer });
}

/**
 * Read new NDJSON lines from soft() live feed and apply to Mongo via updateStep.
 * @param {string} occurrenceId
 * @param {string} liveFile
 * @param {() => number} getOffset
 * @param {(n: number) => void} setOffset
 */
async function ingestLiveStepFile(occurrenceId, liveFile, getOffset, setOffset) {
  if (!fs.existsSync(liveFile)) return;
  const stat = fs.statSync(liveFile);
  let offset = getOffset();
  if (stat.size < offset) offset = 0; // file rotated/replaced
  if (stat.size === offset) return;

  const fd = fs.openSync(liveFile, "r");
  try {
    const len = stat.size - offset;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, offset);
    setOffset(stat.size);
    const chunk = buf.toString("utf8");
    const lines = chunk.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.kind === "step" && ev.stepId && ev.status) {
        try {
          await updateStep(occurrenceId, {
            stepId: ev.stepId,
            title: ev.title,
            status: ev.status,
            error: ev.error,
            marker: ev.marker,
            severity: ev.severity,
          });
        } catch (err) {
          console.warn("[runFlow] live step ingest:", err.message);
        }
      } else if (ev.kind === "issue" && ev.issue) {
        try {
          await upsertReport(occurrenceId, { appendIssue: ev.issue });
        } catch (err) {
          console.warn("[runFlow] live issue ingest:", err.message);
        }
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * @param {string} occurrenceId
 * @param {number} exitCode
 */
async function finalizeOccurrence(occurrenceId, exitCode) {
  const occurrence = await RunningOccurrence.findOne({ occurrenceId });
  if (!occurrence) return;
  if (["passed", "failed", "cancelled"].includes(occurrence.status) && occurrence.finishedAt) {
    // already finalized
    clearMeta(occurrenceId);
    return;
  }

  const reportsRoot =
    occurrence.envSummary?.projectRoot &&
    fs.existsSync(occurrence.envSummary.projectRoot)
      ? occurrence.envSummary.projectRoot
      : ROOT;
  const latestPath = path.join(reportsRoot, "reports", "latest.json");
  let runDir = "";
  let summary = null;
  let issues = null;
  let results = null;
  let issueCount = 0;

  if (fs.existsSync(latestPath)) {
    try {
      const latest = JSON.parse(fs.readFileSync(latestPath, "utf8"));
      if (latest.path) runDir = path.join(reportsRoot, latest.path);
    } catch {
      // ignore
    }
  }

  if (runDir && fs.existsSync(runDir)) {
    for (const [name, assign] of [
      ["summary.json", (v) => (summary = v)],
      ["ISSUES.json", (v) => (issues = v)],
      ["results.json", (v) => (results = v)],
    ]) {
      const p = path.join(runDir, name);
      if (!fs.existsSync(p)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
        assign(parsed);
      } catch {
        // ignore
      }
    }
    issueCount = Array.isArray(issues?.issues) ? issues.issues.length : 0;
  }

  // Prefer live issues already in DB; merge file issues if live empty
  if (
    (!occurrence.liveIssues || occurrence.liveIssues.length === 0) &&
    Array.isArray(issues?.issues)
  ) {
    occurrence.liveIssues = issues.issues;
    occurrence.liveIssueCount = issues.issues.length;
    for (const issue of issues.issues) {
      const sid = issue.step || issue.id;
      const step = occurrence.steps.find((s) => s.stepId === sid);
      if (step && (step.status === "pending" || step.status === "running")) {
        step.status = issue.marker === "[BLOCKED]" ? "blocked" : "failed";
        step.error = String(issue.evidence || "").slice(0, 2000);
        step.marker = issue.marker || "";
        step.severity = issue.severity || "";
        step.finishedAt = new Date();
      }
    }
    occurrence.markModified("steps");
    occurrence.markModified("liveIssues");
  }

  // Reload steps from DB in case soft()/HTTP updated meanwhile
  const fresh = await RunningOccurrence.findOne({ occurrenceId }).lean();
  if (fresh?.steps?.length) {
    occurrence.steps = fresh.steps;
    occurrence.liveIssues = fresh.liveIssues?.length
      ? fresh.liveIssues
      : occurrence.liveIssues;
    occurrence.liveIssueCount =
      fresh.liveIssueCount || occurrence.liveIssueCount || 0;
    occurrence.markModified("steps");
    occurrence.markModified("liveIssues");
  }

  const realExit =
    typeof summary?.exitCode === "number" ? summary.exitCode : exitCode;
  const infraIssue = (issues?.issues || occurrence.liveIssues || []).find(
    (issue) => issue.marker === "[INFRA]" || /Executable doesn't exist/i.test(issue.evidence || ""),
  );
  const infraError = String(
    infraIssue?.evidence ||
      (realExit !== 0
        ? `Playwright exited ${realExit} before reporting live steps`
        : ""),
  ).slice(0, 2000);

  skipIncomplete(occurrence.steps, new Date(), {
    markFailed: realExit !== 0,
    error: infraError,
  });
  occurrence.markModified("steps");
  const failedSteps = occurrence.steps.filter((s) =>
    ["failed", "blocked"].includes(s.status),
  ).length;
  const completedSteps = occurrence.steps.filter((s) =>
    ["passed", "failed", "skipped", "blocked"].includes(s.status),
  ).length;
  const passedSteps = occurrence.steps.filter((s) => s.status === "passed").length;
  const liveIssues = occurrence.liveIssueCount || issueCount || 0;

  // Prefer real Playwright / step outcome over CI soft-pass
  let finalStatus = "failed";
  if (realExit === 0 && failedSteps === 0 && liveIssues === 0) {
    finalStatus = "passed";
  } else if (passedSteps > 0 && failedSteps === 0 && realExit === 0) {
    finalStatus = "passed";
  } else if (completedSteps === 0 && realExit === 0) {
    // Nothing executed but soft-pass exited 0 — treat as failed so UI is honest
    finalStatus = "failed";
  } else {
    finalStatus = failedSteps > 0 || liveIssues > 0 || realExit !== 0 ? "failed" : "passed";
  }

  occurrence.status = finalStatus;
  occurrence.finishedAt = new Date();
  occurrence.exitCode = realExit;
  occurrence.runDir = runDir
    ? path.relative(reportsRoot, runDir).replace(/\\/g, "/")
    : "";
  occurrence.stepsCompleted = countCompleted(occurrence.steps);
  occurrence.stepsTotal = Math.max(
    occurrence.stepsTotal || 0,
    countTotal(occurrence.steps),
  );
  occurrence.currentStepId = null;
  await occurrence.save();

  clearMeta(occurrenceId);

  // Cleanup bat launcher + log keep for debugging (only remove bat)
  try {
    const batPath = path.join(ROOT, "reports", `flow-run-${occurrenceId}.cmd`);
    if (fs.existsSync(batPath)) fs.unlinkSync(batPath);
  } catch {
    // ignore
  }
  try {
    const oldBat = path.join(ROOT, "reports", `.run-${occurrenceId}.cmd`);
    if (fs.existsSync(oldBat)) fs.unlinkSync(oldBat);
  } catch {
    // ignore
  }

  const finalIssues =
    occurrence.liveIssues?.length > 0
      ? { issues: occurrence.liveIssues, count: occurrence.liveIssueCount }
      : issues;

  await Report.findOneAndUpdate(
    { occurrenceId },
    {
      occurrenceId,
      projectId: occurrence.projectId,
      flowId: occurrence.flowId,
      summary,
      issues: finalIssues,
      results,
      issueCount:
        occurrence.liveIssueCount ||
        issueCount ||
        (Array.isArray(finalIssues?.issues) ? finalIssues.issues.length : 0),
      artifactPaths: {
        runDir: occurrence.runDir,
        issuesJson: occurrence.runDir
          ? `${occurrence.runDir}/ISSUES.json`
          : null,
        summaryJson: occurrence.runDir
          ? `${occurrence.runDir}/summary.json`
          : null,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  console.log(
    `[runFlow] finalized ${occurrenceId} status=${occurrence.status} steps=${occurrence.stepsCompleted}/${occurrence.stepsTotal} passed=${passedSteps} failed=${failedSteps} issues=${occurrence.liveIssueCount || issueCount} exit=${realExit}`,
  );
}

async function updateStep(occurrenceId, payload) {
  if (!payload?.stepId || !payload?.status) {
    const err = new Error("stepId and status are required");
    err.status = 400;
    throw err;
  }

  const now = new Date();
  let lastErr = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const occurrence = await RunningOccurrence.findOne({ occurrenceId });
      if (!occurrence) {
        const err = new Error(`Occurrence not found: ${occurrenceId}`);
        err.status = 404;
        throw err;
      }

      if (["passed", "failed", "cancelled"].includes(occurrence.status)) {
        return occurrence.toObject();
      }

      const result = applyLiveStep(occurrence.steps, payload, { now });
      if (result.skipped) {
        return occurrence.toObject();
      }

      if (payload.status === "running") {
        occurrence.currentStepId = result.currentStepId;
      } else if (
        ["passed", "failed", "skipped", "blocked"].includes(payload.status) &&
        occurrence.currentStepId === result.step?.stepId
      ) {
        occurrence.currentStepId = null;
      }

      occurrence.stepsCompleted = countCompleted(occurrence.steps);
      occurrence.stepsTotal = Math.max(
        occurrence.stepsTotal || 0,
        countTotal(occurrence.steps),
      );
      occurrence.markModified("steps");
      await occurrence.save();

      console.log(
        `[runFlow] step ${payload.status} ${payload.stepId} → ${result.step?.stepId || payload.stepId} (${occurrence.stepsCompleted}/${occurrence.stepsTotal}) occ=${occurrenceId.slice(0, 8)}`,
      );

      return occurrence.toObject();
    } catch (err) {
      lastErr = err;
      const versionConflict =
        err?.name === "VersionError" ||
        /No matching document found for id/i.test(String(err?.message || err));
      if (!versionConflict || attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
    }
  }

  throw lastErr;
}

async function upsertReport(occurrenceId, body) {
  const occurrence = await RunningOccurrence.findOne({ occurrenceId });
  if (!occurrence) {
    const err = new Error(`Occurrence not found: ${occurrenceId}`);
    err.status = 404;
    throw err;
  }

  // Mid-run: soft() can append a single issue onto the occurrence (DB source of truth)
  if (body?.appendIssue && typeof body.appendIssue === "object") {
    occurrence.liveIssues = occurrence.liveIssues || [];
    occurrence.liveIssues.push(body.appendIssue);
    occurrence.liveIssueCount = (occurrence.liveIssueCount || 0) + 1;
    occurrence.markModified("liveIssues");
    await occurrence.save();

    if (
      body.summary === undefined &&
      body.issues === undefined &&
      body.results === undefined
    ) {
      return {
        occurrenceId,
        flowId: occurrence.flowId,
        issueCount: occurrence.liveIssueCount,
        appended: true,
      };
    }
  }

  const issueCount = Array.isArray(body?.issues?.issues)
    ? body.issues.issues.length
    : Array.isArray(body?.issues)
      ? body.issues.length
      : body?.issueCount ?? occurrence.liveIssueCount ?? 0;

  const report = await Report.findOneAndUpdate(
    { occurrenceId },
    {
      occurrenceId,
      projectId: occurrence.projectId,
      flowId: occurrence.flowId,
      summary: body.summary ?? undefined,
      issues: body.issues ?? undefined,
      results: body.results ?? undefined,
      issueCount,
      artifactPaths: body.artifactPaths ?? undefined,
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  return report.toObject();
}

function killProcessTree(pid) {
  if (!pid) return;
  const numPid = Number(pid);
  if (!Number.isFinite(numPid) || numPid <= 0) return;
  try {
    // Fast check: if PID is not running, skip slow taskkill
    process.kill(numPid, 0);
  } catch {
    return;
  }
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/F", "/T", "/PID", String(numPid)], {
        windowsHide: true,
        stdio: "ignore",
        timeout: 4000,
      });
    } else {
      try {
        process.kill(-numPid, "SIGKILL");
      } catch {
        process.kill(numPid, "SIGKILL");
      }
    }
  } catch {
    // Process already exited or permission denied
  }
}

/**
 * Stop/cancel an active occurrence, kill process tree, update steps and status.
 * @param {string} occurrenceId
 * @param {string} [reason]
 */
async function stopOccurrence(occurrenceId, reason = "Stopped by user") {
  const occurrence = await RunningOccurrence.findOne({ occurrenceId });
  if (!occurrence) {
    const err = new Error(`Occurrence not found: ${occurrenceId}`);
    err.status = 404;
    throw err;
  }

  // Stop background watcher if active
  if (activeWatchers.has(occurrenceId)) {
    const w = activeWatchers.get(occurrenceId);
    if (w?.timer) clearInterval(w.timer);
    activeWatchers.delete(occurrenceId);
  }

  // Read runner PID file if present
  const pidFile = path.join(ROOT, "reports", `.flow-pid-${occurrenceId}.txt`);
  let runnerPid = null;
  if (fs.existsSync(pidFile)) {
    try {
      const content = fs.readFileSync(pidFile, "utf8").trim();
      if (content) runnerPid = Number(content);
      fs.unlinkSync(pidFile);
    } catch {
      // ignore
    }
  }

  // Kill processes (both worker shell and node runner tree)
  const pidsToKill = new Set();
  if (runnerPid) pidsToKill.add(runnerPid);
  if (occurrence.workerPid) pidsToKill.add(occurrence.workerPid);

  for (const pid of pidsToKill) {
    killProcessTree(pid);
  }

  // Ingest any remaining live steps from live feed
  const liveFile = path.join(ROOT, "reports", "live-steps", `${occurrenceId}.ndjson`);
  let liveOffset = 0;
  try {
    await ingestLiveStepFile(occurrenceId, liveFile, () => liveOffset, (n) => {
      liveOffset = n;
    });
  } catch {
    // ignore
  }

  // Clean up run metadata & exit files
  clearMeta(occurrenceId);
  try {
    const exitFile = path.join(ROOT, "reports", `.flow-exit-${occurrenceId}.txt`);
    if (fs.existsSync(exitFile)) fs.unlinkSync(exitFile);
  } catch {
    // ignore
  }
  try {
    const batPath = path.join(ROOT, "reports", `flow-run-${occurrenceId}.cmd`);
    if (fs.existsSync(batPath)) fs.unlinkSync(batPath);
  } catch {
    // ignore
  }
  try {
    const oldBat = path.join(ROOT, "reports", `.run-${occurrenceId}.cmd`);
    if (fs.existsSync(oldBat)) fs.unlinkSync(oldBat);
  } catch {
    // ignore
  }

  // If already terminal, return
  if (["passed", "failed", "cancelled"].includes(occurrence.status)) {
    return occurrence.toObject();
  }

  // Reload fresh steps from DB in case soft()/HTTP updated meanwhile
  const fresh =
    (await RunningOccurrence.findOne({ occurrenceId }).lean()) ||
    occurrence.toObject();
  const currentSteps = fresh.steps || occurrence.steps || [];

  // Mark pending/running steps as skipped or failed
  const now = new Date();
  for (const step of currentSteps) {
    if (Array.isArray(step.children) && step.children.length) {
      for (const child of step.children) {
        if (child.status === "running") {
          child.status = "failed";
          child.error = reason;
          child.finishedAt = now;
        } else if (child.status === "pending") {
          child.status = "skipped";
          child.finishedAt = now;
        }
      }
      step.status = rollupStatus(step.children);
      if (step.status === "pending" || step.status === "running") {
        step.status = "cancelled";
      }
      if (!step.finishedAt) step.finishedAt = now;
    } else {
      if (step.status === "running") {
        step.status = "failed";
        step.error = reason;
        step.finishedAt = now;
      } else if (step.status === "pending") {
        step.status = "skipped";
        step.finishedAt = now;
      }
    }
  }

  const stepsCompleted = countCompleted(currentSteps);
  const stepsTotal = Math.max(fresh.stepsTotal || 0, countTotal(currentSteps));

  const updatedOccurrence = await RunningOccurrence.findOneAndUpdate(
    { occurrenceId },
    {
      $set: {
        steps: currentSteps,
        status: "cancelled",
        finishedAt: now,
        exitCode: 130,
        currentStepId: null,
        stepsCompleted,
        stepsTotal,
      },
    },
    { returnDocument: "after" },
  );

  // Upsert a report documenting cancellation
  try {
    await Report.findOneAndUpdate(
      { occurrenceId },
      {
        occurrenceId,
        projectId: occurrence.projectId,
        flowId: occurrence.flowId,
        summary: { exitCode: 130, cancelled: true, reason },
        issues: {
          issues: fresh.liveIssues || occurrence.liveIssues || [],
          count: fresh.liveIssueCount || occurrence.liveIssueCount || 0,
        },
        issueCount: fresh.liveIssueCount || occurrence.liveIssueCount || 0,
        artifactPaths: { runDir: occurrence.runDir || "" },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  } catch (err) {
    console.warn("[stopOccurrence] report upsert warning:", err.message);
  }

  console.log(
    `[runFlow] stopped occurrence ${occurrenceId} flow=${occurrence.flowId} status=cancelled`,
  );
  return (updatedOccurrence || occurrence).toObject();
}

/**
 * Stop active run for a specific flow.
 * @param {string|number} flowId
 * @param {string} [projectId]
 * @param {string} [reason]
 */
async function stopFlowRun(flowId, projectId, reason = "Stopped by user") {
  const query = {
    flowId: String(flowId),
    status: { $in: ["running", "queued"] },
  };
  if (projectId) query.projectId = String(projectId);

  let occ = await RunningOccurrence.findOne(query).sort({ createdAt: -1 });
  if (!occ) {
    const activePath = path.join(ROOT, "reports", "odb-active-occurrence.txt");
    if (fs.existsSync(activePath)) {
      const activeId = fs.readFileSync(activePath, "utf8").trim();
      if (activeId) {
        const byActive = await RunningOccurrence.findOne({ occurrenceId: activeId });
        if (byActive && String(byActive.flowId) === String(flowId)) {
          occ = byActive;
        }
      }
    }
  }

  if (!occ) {
    const err = new Error(`No active occurrence running for flow ${flowId}`);
    err.status = 404;
    throw err;
  }

  return await stopOccurrence(occ.occurrenceId, reason);
}

/**
 * Stop all active occurrences.
 * @param {string} [projectId]
 * @param {string} [reason]
 */
async function stopAllOccurrences(projectId, reason = "Stopped by user") {
  const query = { status: { $in: ["running", "queued"] } };
  if (projectId) query.projectId = String(projectId);
  const running = await RunningOccurrence.find(query);
  const stopped = [];
  for (const occ of running) {
    try {
      stopped.push(await stopOccurrence(occ.occurrenceId, reason));
    } catch (err) {
      console.warn(`[stopAllOccurrences] error stopping ${occ.occurrenceId}:`, err.message);
    }
  }
  return stopped;
}

module.exports = {
  startFlowRun,
  finalizeOccurrence,
  updateStep,
  upsertReport,
  stopOccurrence,
  stopFlowRun,
  stopAllOccurrences,
  activeWatchers,
};
