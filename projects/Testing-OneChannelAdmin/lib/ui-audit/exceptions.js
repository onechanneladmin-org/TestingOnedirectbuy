/**
 * Default suppressions for intentional UI. Callers override via uiAudit options.exceptions.
 * An element can also opt out with data-audit-ignore="rule.id,other.rule" or "*".
 */

const DEFAULT_EXCEPTIONS = {
  ignoreRules: [],
  ignoreCategories: [],
  disabled: {
    skipRules: [
      "a11y.contrast",
      "color.invisible-text",
      "controls.undersized-target",
      "interaction.obscured-target",
      "responsive.touch-target",
      "typography.below-minimum",
    ],
  },
  allowedScroll: {
    skipRules: [
      "scroll.horizontal-overflow",
      "responsive.wider-than-viewport",
      "layout.clipped-content",
      "layout.overflows-container",
    ],
  },
  /**
   * Structured opt-outs.
   * { ruleId?, category?, page?, theme?, selectorIncludes?, minWidth?, maxWidth? }
   */
  entries: [],
  theme: {
    darkMaxLuminance: 0.45,
    lightMinLuminance: 0.62,
  },
  contrast: { normal: 4.5, large: 3 },
  overflowTolerancePx: 2,
  overlapRatio: 0.4,
  minTargetPx: 24,
  narrowTouchTargetPx: 44,
  narrowViewportPx: 768,
  minFontPx: 12,
};

function mergeExceptions(overrides = {}) {
  return {
    ...DEFAULT_EXCEPTIONS,
    ...overrides,
    disabled: { ...DEFAULT_EXCEPTIONS.disabled, ...(overrides.disabled || {}) },
    allowedScroll: {
      ...DEFAULT_EXCEPTIONS.allowedScroll,
      ...(overrides.allowedScroll || {}),
    },
    theme: { ...DEFAULT_EXCEPTIONS.theme, ...(overrides.theme || {}) },
    contrast: { ...DEFAULT_EXCEPTIONS.contrast, ...(overrides.contrast || {}) },
    ignoreRules: overrides.ignoreRules || DEFAULT_EXCEPTIONS.ignoreRules,
    ignoreCategories: overrides.ignoreCategories || DEFAULT_EXCEPTIONS.ignoreCategories,
    entries: overrides.entries || DEFAULT_EXCEPTIONS.entries,
  };
}

function isExcepted(finding, exceptions, context) {
  if (exceptions.ignoreRules.includes(finding.ruleId)) return true;
  if (exceptions.ignoreCategories.includes(finding.category)) return true;

  const hints = finding.hints || {};
  const ignore = hints.auditIgnore || [];
  if (ignore.includes("*") || ignore.includes(finding.ruleId)) return true;
  if (hints.disabled && (exceptions.disabled.skipRules || []).includes(finding.ruleId)) {
    return true;
  }
  if (
    hints.allowScroll &&
    (exceptions.allowedScroll.skipRules || []).includes(finding.ruleId) &&
    finding.selector &&
    finding.selector !== "html"
  ) {
    return true;
  }

  for (const entry of exceptions.entries || []) {
    if (entry.ruleId && entry.ruleId !== finding.ruleId) continue;
    if (entry.category && entry.category !== finding.category) continue;
    if (entry.page && entry.page !== context.page) continue;
    if (entry.theme && entry.theme !== context.theme) continue;
    if (entry.minWidth != null && context.viewport.width < entry.minWidth) continue;
    if (entry.maxWidth != null && context.viewport.width > entry.maxWidth) continue;
    if (entry.selectorIncludes && !String(finding.selector).includes(entry.selectorIncludes)) {
      continue;
    }
    return true;
  }
  return false;
}

module.exports = { DEFAULT_EXCEPTIONS, isExcepted, mergeExceptions };
