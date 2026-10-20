const path = require("path");
const fs = require("fs");

const DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "references.json"), "utf8"),
);

/** Map rule ids to reference kinds. */
const RULE_TO_KIND = {
  "design.primary-button": "primary-button",
  "design.dropdown": "form-dropdown",
  "design.tab-underline": "underline-tabs",
  "design.date-pills": "date-pills",
  "design.search-input": "search-input",
  "design.content-card": "content-card",
  "design.chart": "chart",
  "design.table": "table",
  "design.pill-tabs": "pill-tabs",
  "design.sidebar-nav": "nav-item",
  "catalog.metric-card": "metric-card",
};

function getReference(kindOrRuleId) {
  const key = RULE_TO_KIND[kindOrRuleId] || kindOrRuleId;
  return DATA[key] || null;
}

function expectedFor(kindOrRuleId, fallback = "") {
  const ref = getReference(kindOrRuleId);
  return (ref && ref.expected) || fallback;
}

function listReferences() {
  return Object.values(DATA);
}

module.exports = {
  DATA,
  RULE_TO_KIND,
  getReference,
  expectedFor,
  listReferences,
};
