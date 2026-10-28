// node --test lib/ui-audit/components.test.js — pure parts of the component audit (no browser).
const test = require("node:test");
const assert = require("node:assert/strict");
const { staticChecks, groupFindings, KINDS } = require("./components");

const base = { w: 200, h: 36, disabled: false, inRow: false, inDialog: false, required: false, requiredMarked: false, nearbyLabel: "", tooltip: "", prTooltip: false, accept: null };
const item = (over) => ({ ...base, id: `${over.kind}-0`, sel: over.kind, ...over });
const ids = (fs) => fs.map((f) => f.ruleId).sort();

test("components: every probed kind has a selector", () => {
  for (const k of ["text-input", "number-input", "textarea", "dropdown", "multiselect", "autocomplete", "calendar", "checkbox", "radio", "switch", "chips", "file-upload", "column-filter", "paginator", "sortable-header"]) {
    assert.ok(KINDS[k], k);
  }
});

test("components: unnamed control → accessible-name; placeholder-only → placeholder-as-label", () => {
  assert.deepEqual(ids(staticChecks([item({ kind: "dropdown", name: "", via: "" })])), ["components.dropdown.accessible-name"]);
  assert.deepEqual(ids(staticChecks([item({ kind: "text-input", name: "Search", via: "placeholder" })])), ["components.text-input.placeholder-as-label"]);
  assert.deepEqual(staticChecks([item({ kind: "text-input", name: "Email", via: "label" })]), []);
});

test("components: required marker, target size, file accept, icon tooltip", () => {
  const f = staticChecks([
    item({ kind: "text-input", name: "Email", via: "label", required: true, requiredMarked: false }),
    item({ kind: "checkbox", name: "Agree", via: "label", w: 12, h: 12 }),
    item({ kind: "file-upload", name: "Upload", via: "label" }),
    item({ kind: "icon-button", name: "x", via: "title", tooltip: "" }),
  ]);
  assert.deepEqual(ids(f), [
    "components.checkbox.target-size",
    "components.file-upload.accept-types",
    "components.icon-button.tooltip",
    "components.text-input.required-marker",
  ]);
  // Disabled controls are not held to the target size.
  assert.deepEqual(staticChecks([item({ kind: "checkbox", name: "A", via: "label", w: 12, h: 12, disabled: true })]), []);
});

test("components: identical findings on a page are grouped with a count", () => {
  const many = Array.from({ length: 51 }, (_, i) => item({ kind: "checkbox", id: `checkbox-${i}`, name: "", via: "" }));
  const f = staticChecks(many);
  assert.equal(f.length, 1);
  assert.equal(f[0].count, 51);
  assert.match(f[0].message, /51 controls/);
  assert.equal(f[0].selector, '[data-ux-cmp="checkbox-0"]');
  assert.deepEqual(groupFindings([]), []);
});
