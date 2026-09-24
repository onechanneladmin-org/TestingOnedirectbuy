const { contrastRatio, elementsOf, issue } = require("./support");

const SKIPPED = new Set(["hidden", "submit", "button", "reset", "image"]);

module.exports = [
  {
    id: "forms.missing-label",
    category: "forms",
    kind: "deterministic",
    severity: "major",
    description: "A field has no label. Placeholder text is not a label.",
    detect(snapshot) {
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (el.tag !== "input" && el.tag !== "textarea" && el.tag !== "select") continue;
        if (SKIPPED.has(el.inputType)) continue;
        if (el.labelled) continue;
        const placeholder = String(el.placeholder || "").trim();
        findings.push(
          issue(el, {
            message: placeholder
              ? "Field uses a placeholder instead of a label"
              : "Field has no label",
            expected: "label, aria-label, or aria-labelledby",
            actual: placeholder ? `placeholder "${placeholder}"` : "no name",
          }),
        );
      }
      return findings.slice(0, 12);
    },
  },
  {
    id: "forms.placeholder-contrast",
    category: "forms",
    kind: "deterministic",
    severity: "major",
    description: "Placeholder text does not meet contrast against the field background.",
    detect(snapshot, ctx = {}) {
      const min = ctx.options?.exceptions?.contrast?.normal ?? 4.5;
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (!el.placeholder || !el.placeholderColor || !el.background) continue;
        const ratio = contrastRatio(el.placeholderColor, el.background);
        if (ratio == null || ratio >= min) continue;
        findings.push(
          issue(el, {
            message: "Placeholder contrast is below the minimum",
            expected: `contrast >= ${min}:1`,
            actual: `${ratio.toFixed(2)}:1`,
          }),
        );
      }
      return findings.slice(0, 10);
    },
  },
];
