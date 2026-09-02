/**
 * Extract flow steps from a project's spec files (soft() first, then test() titles).
 */
const fs = require("fs");
const path = require("path");

function extractSoftSteps(text, relPath) {
  const rel = relPath.replace(/\\/g, "/");
  const found = [];
  const softRe =
    /(?:await\s+)?soft\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/gs;
  const reqRe =
    /requireSoft\(\s*soft\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/gs;

  let m;
  while ((m = softRe.exec(text))) {
    found.push({ index: m.index, stepId: m[1], title: m[2] });
  }
  while ((m = reqRe.exec(text))) {
    found.push({ index: m.index, stepId: m[1], title: m[2] });
  }
  found.sort((a, b) => a.index - b.index);

  const steps = [];
  const seen = new Set();
  for (const item of found) {
    if (seen.has(item.stepId)) continue;
    seen.add(item.stepId);
    steps.push({
      stepId: item.stepId,
      title: item.title,
      specFile: rel,
    });
  }
  return steps;
}

function humanizeSpec(relPath) {
  return path
    .basename(relPath, path.extname(relPath))
    .replace(/[-_]+/g, " ")
    .trim();
}

function extractTestTitles(text, relPath) {
  const rel = relPath.replace(/\\/g, "/");
  const steps = [];
  const seen = new Set();
  const testRe = /\btest\(\s*["'`]([^"'`]+)["'`]/g;
  let m;
  let n = 0;
  while ((m = testRe.exec(text))) {
    n += 1;
    const rawTitle = String(m[1] || "").trim();
    const title =
      !rawTitle || /^test$/i.test(rawTitle) ? humanizeSpec(relPath) : rawTitle;
    const stepId = `${path.basename(relPath, path.extname(relPath))}-${n}`;
    if (seen.has(stepId)) continue;
    seen.add(stepId);
    steps.push({ stepId, title, specFile: rel });
  }
  return steps;
}

function extractStepsFromFile(absPath, relPath) {
  const text = fs.readFileSync(absPath, "utf8");
  const soft = extractSoftSteps(text, relPath);
  if (soft.length) return soft;
  const tests = extractTestTitles(text, relPath);
  if (tests.length) return tests;
  return [
    {
      stepId: path.basename(relPath, path.extname(relPath)),
      title: humanizeSpec(relPath),
      specFile: relPath.replace(/\\/g, "/"),
    },
  ];
}

/**
 * @param {string} projectRoot
 * @param {object} flow
 * @returns {{ stepId: string; title: string; specFile: string; order: number }[]}
 */
function extractStepsForFlow(projectRoot, flow) {
  const steps = [];
  let order = 1;
  for (const testFile of flow.tests || []) {
    const abs = path.isAbsolute(testFile)
      ? testFile
      : path.join(projectRoot, testFile);
    const rel = String(testFile).replace(/\\/g, "/");
    if (!fs.existsSync(abs)) {
      console.warn(`[extract] Missing spec: ${abs}`);
      continue;
    }
    for (const s of extractStepsFromFile(abs, rel)) {
      steps.push({ ...s, order: order++ });
    }
  }
  return steps;
}

/**
 * @param {string} projectRoot
 * @param {object} flowsConfig
 * @returns {Record<string, { steps: object[]; name?: string; tests?: string[] }>}
 */
function extractCatalog(projectRoot, flowsConfig) {
  const catalog = {};
  for (const flow of flowsConfig.flows || []) {
    const key = String(flow.id);
    catalog[key] = {
      flowId: flow.id,
      name: flow.name,
      enabled: flow.enabled !== false,
      tests: flow.tests || [],
      steps: extractStepsForFlow(projectRoot, flow),
    };
  }
  return catalog;
}

module.exports = {
  extractStepsFromFile,
  extractStepsForFlow,
  extractCatalog,
};
