const express = require("express");
const RunningOccurrence = require("../models/RunningOccurrence");
const Report = require("../models/Report");
const {
  updateStep,
  upsertReport,
  stopOccurrence,
  stopAllOccurrences,
} = require("../services/runFlow");
const { countByStatus } = require("../../lib/applyLiveStep");

const router = express.Router();

/** GET /api/occurrences — recent runs */
router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.projectId) filter.projectId = String(req.query.projectId);
    if (req.query.flowId) filter.flowId = String(req.query.flowId);
    if (req.query.status) filter.status = String(req.query.status);

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const occurrences = await RunningOccurrence.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "occurrenceId projectId flowId flowName status startedAt finishedAt stepsCompleted stepsTotal currentStepId exitCode createdAt steps",
      )
      .lean();

    res.json({
      count: occurrences.length,
      occurrences: occurrences.map((o) => {
        const counts = countByStatus(o.steps);
        return {
          occurrenceId: o.occurrenceId,
          projectId: o.projectId || "",
          flowId: o.flowId,
          flowName: o.flowName,
          status: o.status,
          startedAt: o.startedAt,
          finishedAt: o.finishedAt,
          currentStepId: o.currentStepId,
          exitCode: o.exitCode,
          createdAt: o.createdAt,
          stepsCompleted: counts.passed + counts.failed + counts.skipped,
          stepsTotal: counts.total || o.stepsTotal || 0,
          passed: counts.passed,
          failed: counts.failed,
          skipped: counts.skipped,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/occurrences/:occurrenceId — live status */
router.get("/:occurrenceId", async (req, res, next) => {
  try {
    const occurrence = await RunningOccurrence.findOne({
      occurrenceId: req.params.occurrenceId,
    }).lean();
    if (!occurrence) {
      return res
        .status(404)
        .json({ error: `Occurrence not found: ${req.params.occurrenceId}` });
    }

    const counts = countByStatus(occurrence.steps);
    const stepsTotal = counts.total || occurrence.stepsTotal || 0;
    const stepsCompleted = counts.passed + counts.failed + counts.skipped;

    res.json({
      occurrenceId: occurrence.occurrenceId,
      projectId: occurrence.projectId || "",
      flowId: occurrence.flowId,
      flowName: occurrence.flowName,
      status: occurrence.status,
      startedAt: occurrence.startedAt,
      finishedAt: occurrence.finishedAt,
      currentStepId: occurrence.currentStepId,
      stepsCompleted,
      stepsTotal,
      passed: counts.passed,
      failed: counts.failed,
      skipped: counts.skipped,
      workerPid: occurrence.workerPid,
      exitCode: occurrence.exitCode,
      runDir: occurrence.runDir,
      liveIssueCount: occurrence.liveIssueCount || 0,
      liveIssues: occurrence.liveIssues || [],
      useCaseId: occurrence.envSummary?.useCaseId || "",
      progress: {
        pending: counts.pending,
        running: counts.running,
        passed: counts.passed,
        failed: counts.failed,
        skipped: counts.skipped,
        percent:
          stepsTotal > 0 ? Math.round((stepsCompleted / stepsTotal) * 100) : 0,
      },
      steps: occurrence.steps,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/occurrences/:occurrenceId/steps — internal step update from soft() */
router.post("/:occurrenceId/steps", async (req, res, next) => {
  try {
    const occurrence = await updateStep(req.params.occurrenceId, req.body || {});
    res.json({
      occurrenceId: occurrence.occurrenceId,
      status: occurrence.status,
      currentStepId: occurrence.currentStepId,
      stepsCompleted: occurrence.stepsCompleted,
      stepsTotal: occurrence.stepsTotal,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

/** GET /api/occurrences/:occurrenceId/report */
router.get("/:occurrenceId/report", async (req, res, next) => {
  try {
    const report = await Report.findOne({
      occurrenceId: req.params.occurrenceId,
    }).lean();
    if (!report) {
      const occurrence = await RunningOccurrence.findOne({
        occurrenceId: req.params.occurrenceId,
      }).lean();
      if (!occurrence) {
        return res
          .status(404)
          .json({ error: `Occurrence not found: ${req.params.occurrenceId}` });
      }
      return res.status(404).json({
        error: "Report not ready yet",
        occurrenceStatus: occurrence.status,
      });
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

/** POST /api/occurrences/:occurrenceId/report — upload final report/issues */
router.post("/:occurrenceId/report", async (req, res, next) => {
  try {
    const report = await upsertReport(req.params.occurrenceId, req.body || {});
    res.status(201).json(report);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

/** POST /api/occurrences/stop-all — stop all running occurrences */
router.post("/stop-all", async (req, res, next) => {
  try {
    const reason = req.body?.reason || "Stopped all from API";
    const stopped = await stopAllOccurrences(
      req.query.projectId || req.body?.projectId,
      reason,
    );
    res.json({ ok: true, count: stopped.length, occurrences: stopped });
  } catch (err) {
    next(err);
  }
});

/** POST /api/occurrences/:occurrenceId/stop (or /cancel) — stop a specific occurrence */
router.post(["/:occurrenceId/stop", "/:occurrenceId/cancel"], async (req, res, next) => {
  try {
    const reason = req.body?.reason || "Stopped by user";
    const occurrence = await stopOccurrence(req.params.occurrenceId, reason);
    res.json({
      ok: true,
      occurrenceId: occurrence.occurrenceId,
      status: occurrence.status,
      occurrence,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
