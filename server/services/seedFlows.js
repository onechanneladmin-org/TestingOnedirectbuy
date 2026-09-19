/**
 * Seed / upsert Flow documents from each project's flows config + extracted steps.
 * Optional per-flow `catalog` TSV becomes the sheet rows (use-case metadata).
 */
const fs = require("fs");
const path = require("path");
const Flow = require("../models/Flow");
const RunningOccurrence = require("../models/RunningOccurrence");
const { FLOW_STEPS_DATA, ROOT } = require("../config");
const {
  loadUseCaseCatalog,
  matchingExtractedSteps,
} = require("../lib/useCaseCatalog");
const { listProjects, defaultProjectId } = require("../lib/projects");
const { extractCatalog } = require("../lib/extractProjectSteps");

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Ensure this repo's flow-steps.json exists by running the extractor if missing.
 */
function ensureFlowStepsData() {
  if (fs.existsSync(FLOW_STEPS_DATA)) return;
  const extractor = path.join(ROOT, "scripts", "extract-flow-steps.js");
  if (fs.existsSync(extractor)) {
    require("child_process").execFileSync(process.execPath, [extractor], {
      cwd: ROOT,
      stdio: "inherit",
    });
  }
}

/**
 * Drop the old global unique on flowId so projects can share numeric ids.
 */
async function ensureProjectScopedIndexes() {
  try {
    const indexes = await Flow.collection.indexes();
    for (const idx of indexes) {
      const keys = Object.keys(idx.key || {});
      if (idx.unique && keys.length === 1 && keys[0] === "flowId") {
        await Flow.collection.dropIndex(idx.name);
        console.log(`[seed] dropped global unique index ${idx.name}`);
      }
    }
  } catch (err) {
    console.warn("[seed] index migrate:", err.message);
  }
  await Flow.updateMany(
    { $or: [{ projectId: { $exists: false } }, { projectId: "" }] },
    { $set: { projectId: defaultProjectId() } },
  );
  await RunningOccurrence.updateMany(
    { $or: [{ projectId: { $exists: false } }, { projectId: "" }] },
    { $set: { projectId: defaultProjectId() } },
  );
}

/**
 * @param {object} flow
 * @param {object} fromCatalog extracted soft() steps
 * @param {string} projectRoot
 */
function buildSteps(flow, fromCatalog, projectRoot = ROOT) {
  const extracted = Array.isArray(fromCatalog.steps) ? fromCatalog.steps : [];

  if (flow.catalog) {
    const rows = loadUseCaseCatalog(flow.catalog, projectRoot);
    return rows.map((row, i) => {
      const matches = matchingExtractedSteps(row.id, extracted);
      const specFile = matches.find((m) => m.specFile)?.specFile || "";
      return {
        stepId: row.id,
        title: row.useCase || row.id,
        specFile,
        order: i + 1,
        dependsOn: null,
        module: row.module,
        actor: row.actor,
        useCase: row.useCase,
        description: row.description,
        priority: row.priority,
        automation: row.automation,
        currentStatus: row.currentStatus,
        children: matches.map((m, j) => ({
          stepId: m.stepId,
          title: m.title,
          specFile: m.specFile || "",
          order: j + 1,
          dependsOn: m.dependsOn || null,
        })),
      };
    });
  }

  return extracted.map((s, i) => ({
    stepId: s.stepId,
    title: s.title,
    specFile: s.specFile || "",
    order: s.order ?? i + 1,
    dependsOn: s.dependsOn || null,
    module: "",
    actor: "",
    useCase: "",
    description: "",
    priority: "",
    automation: "",
    currentStatus: "",
    children: [],
  }));
}

function stampNow() {
  return new Date();
}

function childFingerprint(c) {
  return JSON.stringify({
    stepId: String(c?.stepId || ""),
    title: c?.title || "",
    specFile: c?.specFile || "",
    order: c?.order ?? 0,
    dependsOn: c?.dependsOn || null,
  });
}

function stepFingerprint(s) {
  return JSON.stringify({
    stepId: String(s?.stepId || ""),
    title: s?.title || "",
    specFile: s?.specFile || "",
    order: s?.order ?? 0,
    dependsOn: s?.dependsOn || null,
    module: s?.module || "",
    actor: s?.actor || "",
    useCase: s?.useCase || "",
    description: s?.description || "",
    priority: s?.priority || "",
    automation: s?.automation || "",
    currentStatus: s?.currentStatus || "",
    children: (s?.children || []).map(childFingerprint),
  });
}

function flowFingerprint(name, enabled, tests, catalog, steps, group) {
  return JSON.stringify({
    name: name || "",
    enabled: enabled !== false,
    tests: tests || [],
    catalog: catalog || "",
    group: group || "",
    steps: (steps || []).map(stepFingerprint),
  });
}

function stampChild(child, prev, now, fallback) {
  if (!prev) {
    return { ...child, createdAt: now, updatedAt: now };
  }
  const createdAt = prev.createdAt || fallback || now;
  const changed = childFingerprint(child) !== childFingerprint(prev);
  return {
    ...child,
    createdAt,
    updatedAt: changed ? now : prev.updatedAt || createdAt,
  };
}

function stampSteps(incoming, existingSteps, now, fallback) {
  const prevById = new Map(
    (existingSteps || []).map((s) => [String(s.stepId), s]),
  );
  return (incoming || []).map((step) => {
    const prev = prevById.get(String(step.stepId));
    const prevChildren = new Map(
      (prev?.children || []).map((c) => [String(c.stepId), c]),
    );
    const createdAt = prev?.createdAt || fallback || now;
    const children = (step.children || []).map((c) =>
      stampChild(c, prevChildren.get(String(c.stepId)), now, createdAt),
    );
    if (!prev) {
      return { ...step, createdAt: now, updatedAt: now, children };
    }
    const changed = stepFingerprint({ ...step, children: step.children }) !==
      stepFingerprint(prev);
    return {
      ...step,
      createdAt,
      updatedAt: changed ? now : prev.updatedAt || createdAt,
      children,
    };
  });
}

function stepsHaveTimes(steps) {
  return (steps || []).every(
    (s) =>
      s.createdAt &&
      s.updatedAt &&
      (s.children || []).every((c) => c.createdAt && c.updatedAt),
  );
}

function loadProjectCatalog(project) {
  const stepsPath = path.join(project.root, "server", "data", "flow-steps.json");
  if (project.id === "onedirectbuy") {
    ensureFlowStepsData();
    return loadJson(FLOW_STEPS_DATA) || loadJson(stepsPath) || {};
  }
  if (fs.existsSync(stepsPath)) {
    return loadJson(stepsPath) || {};
  }
  return {};
}

/**
 * @param {string} [projectId] seed one project, or all when omitted
 * @returns {Promise<{ upserted: number; flows: object[] }>}
 */
async function seedFlows(projectId) {
  await ensureProjectScopedIndexes();

  const targets = projectId
    ? listProjects().filter((p) => p.id === String(projectId))
    : listProjects();

  if (projectId && targets.length === 0) {
    throw new Error(`Unknown project: ${projectId}`);
  }

  const upserted = [];

  for (const project of targets) {
    if (!fs.existsSync(project.flowsConfig)) {
      console.warn(
        `[seed] skip ${project.id}: flows config missing at ${project.flowsConfig}`,
      );
      continue;
    }

    const flowsConfig = loadJson(project.flowsConfig);
    if (!flowsConfig || !Array.isArray(flowsConfig.flows)) {
      console.warn(`[seed] skip ${project.id}: invalid ${project.flowsConfig}`);
      continue;
    }

    let catalog = project.runnable ? loadProjectCatalog(project) : {};
    const extracted = project.runnable
      ? extractCatalog(project.root, flowsConfig)
      : {};
    for (const [key, value] of Object.entries(extracted)) {
      const existing = catalog[key];
      const existingSteps = Array.isArray(existing?.steps) ? existing.steps : [];
      if (!existingSteps.length && value.steps?.length) {
        catalog[key] = value;
      } else if (!catalog[key]) {
        catalog[key] = value;
      }
    }

    const keepIds = [];

    for (const flow of flowsConfig.flows) {
      const key = String(flow.id);
      keepIds.push(key);
      const fromCatalog = catalog[key] || extracted[key] || {};
      const name = flow.name || fromCatalog.name || `Flow ${key}`;
      const enabled = flow.enabled !== false;
      const tests = flow.tests || fromCatalog.tests || [];
      const catalogPath = flow.catalog || "";
      const group = flow.group || "";
      const existing = await Flow.findOne({
        projectId: project.id,
        flowId: key,
      }).lean();
      const now = stampNow();
      const fallbackCreated = existing?.createdAt || now;
      const steps = stampSteps(
        buildSteps(flow, fromCatalog, project.root),
        existing?.steps,
        now,
        fallbackCreated,
      );

      const nextKey = flowFingerprint(
        name,
        enabled,
        tests,
        catalogPath,
        steps,
        group,
      );
      const prevKey = existing
        ? flowFingerprint(
            existing.name,
            existing.enabled,
            existing.tests,
            existing.catalog,
            existing.steps,
            existing.group,
          )
        : "";
      const contentChanged = !existing || nextKey !== prevKey;
      const needsStepTimes = existing && !stepsHaveTimes(existing.steps);

      if (existing && !contentChanged && !needsStepTimes) {
        upserted.push(existing);
        continue;
      }

      const payload = {
        projectId: project.id,
        flowId: key,
        name,
        enabled,
        tests,
        catalog: catalogPath,
        group,
        steps,
      };

      if (!existing) {
        const doc = await Flow.create(payload);
        upserted.push(doc);
        continue;
      }

      const doc = await Flow.findOneAndUpdate(
        { projectId: project.id, flowId: key },
        { $set: contentChanged ? payload : { steps } },
        {
          returnDocument: "after",
          timestamps: contentChanged,
        },
      );
      upserted.push(doc);
    }

    await Flow.deleteMany({
      projectId: project.id,
      flowId: { $nin: keepIds },
    });

    console.log(
      `[seed] ${project.id}: ${keepIds.length} flow(s) from ${project.flowsConfig}`,
    );
  }

  return { upserted: upserted.length, flows: upserted };
}

module.exports = { seedFlows, ensureFlowStepsData, ensureProjectScopedIndexes };
