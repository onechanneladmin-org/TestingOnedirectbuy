const { contrastRatio, isLargeText, isNeutral, luminance, parseCssColor } = require("../contrast");

function px(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function describe(el) {
  if (!el) return "";
  const role = el.role || el.tag || "element";
  const name = String(el.name || el.text || "").trim();
  const short = name.length > 80 ? `${name.slice(0, 77)}...` : name;
  return short ? `${role} "${short}"` : String(role);
}

function hintsFrom(el) {
  if (!el) return { auditIgnore: [], disabled: false, allowScroll: false, bbox: null, styles: null };
  return {
    auditIgnore: el.auditIgnore || [],
    disabled: !!el.disabled,
    allowScroll: !!el.allowScroll,
    bbox: el.bbox || null,
    styles: el.styles || null,
  };
}

function issue(el, fields) {
  return {
    ...fields,
    element: fields.element || describe(el),
    selector: fields.selector || (el && el.selector) || "",
    hints: fields.hints || hintsFrom(el),
  };
}

function elementsOf(snapshot) {
  return snapshot.elements || [];
}

function intersectionArea(a, b) {
  if (!a || !b) return 0;
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

function related(a, b) {
  const aAncestors = a.ancestors || [];
  const bAncestors = b.ancestors || [];
  return aAncestors.includes(b.selector) || bAncestors.includes(a.selector);
}

function sameRow(a, b) {
  const overlap =
    Math.min(a.bbox.y + a.bbox.height, b.bbox.y + b.bbox.height) - Math.max(a.bbox.y, b.bbox.y);
  return overlap > Math.min(a.bbox.height, b.bbox.height) * 0.5;
}

module.exports = {
  contrastRatio,
  describe,
  elementsOf,
  hintsFrom,
  intersectionArea,
  isLargeText,
  isNeutral,
  issue,
  luminance,
  parseCssColor,
  px,
  related,
  sameRow,
};
