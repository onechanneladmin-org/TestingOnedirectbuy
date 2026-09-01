/**
 * Seed / upsert Flow documents from flows.config.json + server/data/flow-steps.json
 * Optional per-flow `catalog` TSV becomes the sheet rows (use-case metadata).
 */
const fs = require("fs");
const path = require("path");
const Flow = require("../models/Flow");
const { FLOWS_CONFIG, FLOW_STEPS_DATA, ROOT } = require("../config");
const {
  loadUseCaseCatalog,
  matchingExtractedSteps,
} = require("../lib/useCaseCatalog");

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Ensure flow-steps.json exists by running the extractor if missing.
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
 * @param {object} flow
 * @param {object} fromCatalog extracted soft() steps
 */
function buildSteps(flow, fromCatalog) {
  const extracted = Array.isArray(fromCatalog.steps) ? fromCatalog.steps : [];

  if (flow.catalog) {
    const rows = loadUseCaseCatalog(flow.catalog);
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
  }));
}

/**
 * @returns {Promise<{ upserted: number; flows: object[] }>}
 */
async function seedFlows() {
  ensureFlowStepsData();

  const flowsConfig = loadJson(FLOWS_CONFIG);
  const catalog = loadJson(FLOW_STEPS_DATA) || {};

  if (!flowsConfig || !Array.isArray(flowsConfig.flows)) {
    throw new Error(`Invalid flows config: ${FLOWS_CONFIG}`);
  }

  const upserted = [];

  for (const flow of flowsConfig.flows) {
    const key = String(flow.id);
    const fromCatalog = catalog[key] || {};
    const steps = buildSteps(flow, fromCatalog);

    const doc = await Flow.findOneAndUpdate(
      { flowId: key },
      {
        flowId: key,
        name: flow.name || fromCatalog.name || `Flow ${key}`,
        enabled: flow.enabled !== false,
        tests: flow.tests || fromCatalog.tests || [],
        catalog: flow.catalog || "",
        steps,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    upserted.push(doc);
  }

  return { upserted: upserted.length, flows: upserted };
}

module.exports = { seedFlows, ensureFlowStepsData };
