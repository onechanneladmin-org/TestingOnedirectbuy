/**
 * Load a tab-separated use-case catalog (sheet columns).
 */
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../config");

/**
 * @param {string} relativeOrAbsolute
 * @returns {{
 *   id: string;
 *   module: string;
 *   actor: string;
 *   useCase: string;
 *   description: string;
 *   priority: string;
 *   automation: string;
 *   currentStatus: string;
 * }[]}
 */
function loadUseCaseCatalog(relativeOrAbsolute, projectRoot = ROOT) {
  const filePath = path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.join(projectRoot, relativeOrAbsolute);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Use-case catalog not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const cols = lines[0].split("\t");
  const idx = {
    id: cols.indexOf("Use Case ID"),
    module: cols.indexOf("Module"),
    actor: cols.indexOf("Actor"),
    useCase: cols.indexOf("Use Case"),
    description: cols.indexOf("Description"),
    priority: cols.indexOf("Priority"),
    automation: cols.indexOf("Automation"),
    currentStatus: cols.indexOf("Current Onedirectbuy Status"),
  };

  return lines.slice(1).map((line) => {
    const parts = line.split("\t");
    return {
      id: parts[idx.id] || parts[0] || "",
      module: idx.module >= 0 ? parts[idx.module] || "" : "",
      actor: idx.actor >= 0 ? parts[idx.actor] || "" : "",
      useCase: idx.useCase >= 0 ? parts[idx.useCase] || "" : "",
      description: idx.description >= 0 ? parts[idx.description] || "" : "",
      priority: idx.priority >= 0 ? parts[idx.priority] || "" : "",
      automation: idx.automation >= 0 ? parts[idx.automation] || "" : "",
      currentStatus:
        idx.currentStatus >= 0 ? parts[idx.currentStatus] || "" : "",
    };
  });
}

/**
 * Match extracted soft() steps to a catalog row (ODB-UC-005-b → ODB-UC-005).
 * @param {string} catalogId
 * @param {{ stepId: string; specFile?: string }[]} extracted
 */
function matchingExtractedSteps(catalogId, extracted) {
  return (extracted || []).filter(
    (s) =>
      s.stepId === catalogId ||
      String(s.stepId).startsWith(`${catalogId}-`) ||
      String(s.stepId).startsWith(`${catalogId}:`),
  );
}

/**
 * Playwright --grep pattern for a catalog id (does not match ODB-UC-0010).
 * @param {string} catalogId
 */
function grepUseCasePattern(catalogId) {
  const escaped = String(catalogId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `${escaped}(?:[:\\s-]|$)`;
}

module.exports = {
  loadUseCaseCatalog,
  matchingExtractedSteps,
  grepUseCasePattern,
};
