const fs = require("fs");
const path = require("path");

const KINDS = new Set(["deterministic", "heuristic", "visual", "review"]);

/** Rules registered at runtime, in addition to files under ./rules. */
const extras = [];
/** @type {object[] | null} */
let builtIns = null;

function assertRule(rule) {
  if (!rule || typeof rule.detect !== "function") {
    throw new Error("Audit rule is missing detect()");
  }
  if (!rule.id || !rule.category || !rule.kind) {
    throw new Error(`Audit rule ${rule.id || "(unnamed)"} requires id, category, and kind`);
  }
  if (!KINDS.has(rule.kind)) {
    throw new Error(
      `Rule ${rule.id} kind "${rule.kind}" must be deterministic, heuristic, visual, or review`,
    );
  }
}

/**
 * Register a rule without editing the engine. Prefer a new file in ./rules,
 * which is loaded automatically.
 */
function registerRule(rule) {
  assertRule(rule);
  extras.push(rule);
  return rule;
}

function readBuiltIns() {
  const dir = path.join(__dirname, "rules");
  /** @type {object[]} */
  const loaded = [];
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".js") && name !== "support.js" && !name.startsWith("_"))
    .sort();
  for (const file of files) {
    const exported = require(path.join(dir, file));
    const rules = Array.isArray(exported) ? exported : [exported];
    for (const rule of rules) {
      assertRule(rule);
      loaded.push(rule);
    }
  }
  const ids = new Set();
  for (const rule of loaded) {
    if (ids.has(rule.id)) throw new Error(`Duplicate audit rule id ${rule.id}`);
    ids.add(rule.id);
  }
  return loaded;
}

function loadBuiltInRules() {
  if (!builtIns) builtIns = readBuiltIns();
  return builtIns.concat(extras);
}

function listRules() {
  return loadBuiltInRules().map((rule) => ({
    id: rule.id,
    category: rule.category,
    kind: rule.kind,
    severity: rule.severity || "minor",
    description: rule.description || "",
  }));
}

function resetRegistryForTests() {
  extras.length = 0;
  builtIns = null;
}

module.exports = {
  assertRule,
  listRules,
  loadBuiltInRules,
  registerRule,
  resetRegistryForTests,
};
