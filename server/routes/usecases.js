const express = require("express");
const UseCase = require("../models/UseCase");
const { syncFromSheet, sheetConfigured, recordResults } = require("../services/useCaseStore");
const { resultsFromTests, testsFromPlaywrightJson } = require("../../lib/useCaseReport");
const { summarize, resultsCsv } = require("../lib/useCaseResults");

const router = express.Router();
const LIST_FIELDS = "-_id -__v -history";

/** GET /api/usecases?tab=&priority=&status=&flow=&q=&limit= — definitions + latest result */
router.get("/", async (req, res, next) => {
  try {
    const { tab, priority, status, flow, q } = req.query;
    const filter = {};
    if (tab) filter.tab = String(tab);
    if (priority) filter.priority = String(priority).toUpperCase();
    if (flow) filter.flow = String(flow);
    if (status === "not run") filter.lastResult = null;
    else if (status) filter["lastResult.status"] = String(status);
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ useCaseId: re }, { title: re }, { module: re }, { description: re }];
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 2000);
    const items = await UseCase.find(filter, LIST_FIELDS).sort({ useCaseId: 1 }).limit(limit).lean();
    res.json({ count: items.length, items });
  } catch (err) {
    next(err);
  }
});

/** GET /api/usecases/summary — coverage dashboard numbers */
router.get("/summary", async (_req, res, next) => {
  try {
    const all = await UseCase.find({ inSheet: { $ne: false } }, LIST_FIELDS).lean();
    const lastSync = await UseCase.findOne({ syncedAt: { $ne: null } }, "syncedAt").sort({ syncedAt: -1 }).lean();
    const notInSheet = await UseCase.countDocuments({ inSheet: false });
    res.json({ ...summarize(all), sheetConfigured: sheetConfigured(), lastSyncAt: lastSync ? lastSync.syncedAt : null, notInSheet });
  } catch (err) {
    next(err);
  }
});

/** GET /api/usecases/export.csv — latest result per use case, to paste back into the sheet */
router.get("/export.csv", async (_req, res, next) => {
  try {
    const all = await UseCase.find({}, LIST_FIELDS).sort({ tab: 1, useCaseId: 1 }).lean();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="use-case-results.csv"');
    res.send(resultsCsv(all));
  } catch (err) {
    next(err);
  }
});

/** POST /api/usecases/sync — pull the Google Sheet now */
router.post("/sync", async (_req, res, next) => {
  try {
    res.json(await syncFromSheet());
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/**
 * POST /api/usecases/results — record results from any runner (this app's reporter, the 1CA e2e
 * suite, a manual tester). Body: { source, runId, results:[{useCaseId,status,error}] }
 * or { source, runId, playwrightReport: <Playwright JSON reporter output> }.
 */
router.post("/results", async (req, res, next) => {
  try {
    const body = req.body || {};
    let results = Array.isArray(body.results) ? body.results : null;
    if (!results && body.playwrightReport) results = resultsFromTests(testsFromPlaywrightJson(body.playwrightReport));
    if (!results) return res.status(400).json({ error: "Send results:[{useCaseId,status,error}] or playwrightReport." });
    if (results.length > 5000) return res.status(413).json({ error: "At most 5000 results per call." });
    const source = String(body.source || "api").slice(0, 60);
    const runId = String(body.runId || `${source}-${new Date().toISOString()}`).slice(0, 120);
    const out = await recordResults(results, { source, runId, flowId: String(body.flowId || "").slice(0, 120) });
    res.status(201).json({ ...out, runId, received: results.length });
  } catch (err) {
    next(err);
  }
});

/** GET /api/usecases/:useCaseId — one use case with its run history */
router.get("/:useCaseId", async (req, res, next) => {
  try {
    const uc = await UseCase.findOne({ useCaseId: String(req.params.useCaseId).toUpperCase() }, "-_id -__v").lean();
    if (!uc) return res.status(404).json({ error: `Use case not found: ${req.params.useCaseId}` });
    res.json(uc);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
