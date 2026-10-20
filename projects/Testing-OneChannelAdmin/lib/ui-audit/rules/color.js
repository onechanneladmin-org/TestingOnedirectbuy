const { contrastRatio, elementsOf, isNeutral, issue, parseCssColor } = require("./support");

module.exports = [
  {
    id: "color.invisible-text",
    category: "color",
    kind: "deterministic",
    severity: "critical",
    description: "Text is transparent or nearly the same color as its background.",
    detect(snapshot) {
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (!el.text || el.text.length < 2 || el.disabled) continue;
        if (!el.foreground || !el.background) continue;
        const ratio = contrastRatio(el.foreground, el.background);
        const invisible = (el.foreground.a != null && el.foreground.a < 0.2) || (ratio != null && ratio < 1.3);
        if (!invisible) continue;
        findings.push(
          issue(el, {
            message: "Text is effectively invisible against its background",
            expected: "foreground with contrast of at least 1.3:1 and opacity >= 0.2",
            actual: `contrast ${ratio == null ? "unknown" : ratio.toFixed(2)} alpha ${el.foreground.a}`,
          }),
        );
        if (findings.length >= 10) break;
      }
      return findings;
    },
  },
  {
    id: "color.too-many-accents",
    category: "color",
    kind: "heuristic",
    severity: "minor",
    description: "Buttons use many unrelated accent backgrounds.",
    detect(snapshot) {
      const colors = new Set();
      for (const el of elementsOf(snapshot)) {
        if (el.controlKind !== "button" || !el.background || el.background.a < 0.9) continue;
        if (isNeutral(el.background)) continue;
        const key = [el.background.r, el.background.g, el.background.b]
          .map((channel) => Math.round(channel / 16) * 16)
          .join(",");
        colors.add(key);
      }
      if (colors.size < 6) return [];
      return [
        issue(null, {
          element: "buttons",
          selector: "button",
          message: "Many distinct non-neutral button colors",
          expected: "a small accent palette",
          actual: `${colors.size} accent colors`,
          confidence: 0.4,
        }),
      ];
    },
  },
  {
    id: "color.gradient-text-without-fill",
    category: "color",
    kind: "deterministic",
    severity: "major",
    description: "Text fill is transparent but no gradient is painted behind it.",
    detect(snapshot) {
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (!el.styles || !el.text) continue;
        const fill = parseCssColor(el.styles.webkitTextFillColor);
        const image = el.styles.backgroundImage || "";
        if (!fill || fill.a >= 0.2) continue;
        if (el.foreground && el.foreground.a < 0.2) continue;
        if (String(image).includes("gradient")) continue;
        findings.push(
          issue(el, {
            message: "Text fill is transparent without a gradient background",
            expected: "opaque text, or background-clip text with a visible gradient",
            actual: `fill ${el.styles.webkitTextFillColor}`,
          }),
        );
      }
      return findings.slice(0, 8);
    },
  },
];
