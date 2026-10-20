/**
 * Generalized UI audit for One Channel Admin.
 *
 *   const { uiAudit } = require("./lib/ui-audit");
 *   const result = await uiAudit(page, { pageName, theme, viewport });
 *   process.exitCode = result.exitCode;
 *
 * Add a rule by dropping a module in lib/ui-audit/rules/ that exports a rule
 * or an array of rules: { id, category, kind, severity, detect(snapshot, ctx) }.
 * kind is deterministic | heuristic | visual | review.
 * Do not edit engine.js to add a check.
 *
 * Opt out on an element with data-audit-ignore="rule.id" or "*".
 * Mark intentional scrollers with data-audit-allow-scroll.
 * Mark empty collections with data-audit-empty.
 */
const { uiAudit } = require("./engine");
const { listRules, registerRule } = require("./registry");
const { exitCodeFor } = require("./exit-code");

module.exports = { exitCodeFor, listRules, registerRule, uiAudit };
