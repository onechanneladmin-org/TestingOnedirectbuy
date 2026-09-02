const express = require("express");
const Flow = require("../models/Flow");
const { startFlowRun } = require("../services/runFlow");
const { seedFlows } = require("../services/seedFlows");
const { defaultProjectId } = require("../lib/projects");

const router = express.Router();

function projectFromReq(req) {
  return String(
    req.query.projectId || req.body?.projectId || defaultProjectId(),
  ).trim();
}

function iso(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function mapChild(c) {
  return {
    stepId: c.stepId,
    title: c.title,
    specFile: c.specFile || "",
    order: c.order,
    dependsOn: c.dependsOn || null,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

function mapStep(s) {
  return {
    stepId: s.stepId,
    title: s.title,
    order: s.order,
    specFile: s.specFile,
    dependsOn: s.dependsOn || null,
    module: s.module || "",
    actor: s.actor || "",
    useCase: s.useCase || "",
    description: s.description || "",
    priority: s.priority || "",
    automation: s.automation || "",
    currentStatus: s.currentStatus || "",
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
    children: (s.children || []).map(mapChild),
  };
}

function mapFlow(f) {
  return {
    projectId: f.projectId,
    flowId: f.flowId,
    name: f.name,
    enabled: f.enabled,
    tests: f.tests,
    catalog: f.catalog || "",
    createdAt: iso(f.createdAt),
    updatedAt: iso(f.updatedAt),
    stepsTotal: (f.steps || []).length,
    steps: (f.steps || []).map(mapStep),
  };
}

/** GET /api/flows — list flows with step outlines (scoped to projectId) */
router.get("/", async (req, res, next) => {
  try {
    const projectId = projectFromReq(req);
    let flows = await Flow.find({ projectId }).sort({ flowId: 1 }).lean();
    if (flows.length === 0) {
      await seedFlows(projectId);
      flows = await Flow.find({ projectId }).sort({ flowId: 1 }).lean();
    }
    res.json({
      projectId,
      count: flows.length,
      flows: flows.map(mapFlow),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/flows/:flowId */
router.get("/:flowId", async (req, res, next) => {
  try {
    const projectId = projectFromReq(req);
    const flow = await Flow.findOne({
      projectId,
      flowId: String(req.params.flowId),
    }).lean();
    if (!flow) {
      return res.status(404).json({
        error: `Flow not found: ${req.params.flowId} (${projectId})`,
      });
    }
    res.json(mapFlow(flow));
  } catch (err) {
    next(err);
  }
});

/** POST /api/flows/:flowId/run — trigger Playwright for this flow */
router.post("/:flowId/run", async (req, res, next) => {
  try {
    const projectId = projectFromReq(req);
    const headed = Boolean(req.body?.headed);
    const useCaseId = req.body?.useCaseId
      ? String(req.body.useCaseId).trim()
      : "";
    const occurrence = await startFlowRun(String(req.params.flowId), {
      headed,
      useCaseId: useCaseId || undefined,
      projectId,
    });
    res.status(202).json({
      occurrenceId: occurrence.occurrenceId,
      projectId: occurrence.projectId,
      flowId: occurrence.flowId,
      flowName: occurrence.flowName,
      status: occurrence.status,
      stepsTotal: occurrence.stepsTotal,
      stepsCompleted: occurrence.stepsCompleted,
      workerPid: occurrence.workerPid,
      useCaseId: occurrence.envSummary?.useCaseId || "",
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
