const { elementsOf, issue, px } = require("./support");

module.exports = [
  {
    id: "typography.below-minimum",
    category: "typography",
    kind: "deterministic",
    severity: "major",
    description: "Text is smaller than the configured minimum.",
    detect(snapshot, ctx = {}) {
      const min = ctx.options?.exceptions?.minFontPx ?? 12;
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (!el.text || el.text.length < 2 || el.disabled || !el.styles) continue;
        const size = px(el.styles.fontSize);
        if (!size || size >= min) continue;
        findings.push(
          issue(el, {
            severity: size < 10 ? "major" : "minor",
            message: "Text is below the minimum readable size",
            expected: `font-size >= ${min}px`,
            actual: `${size}px`,
          }),
        );
        if (findings.length >= 10) break;
      }
      return findings;
    },
  },
  {
    id: "typography.too-many-sizes",
    category: "typography",
    kind: "heuristic",
    severity: "minor",
    description: "The page uses more font sizes than a typical scale.",
    detect(snapshot) {
      const sizes = new Set();
      for (const el of elementsOf(snapshot)) {
        if (!el.text || !el.styles) continue;
        const size = Math.round(px(el.styles.fontSize));
        if (size) sizes.add(size);
      }
      if (sizes.size < 8) return [];
      return [
        issue(null, {
          element: "text",
          selector: "body",
          message: "Too many distinct font sizes",
          expected: "a small type scale",
          actual: `${sizes.size} sizes (${[...sizes].sort((a, b) => a - b).join(", ")}px)`,
          confidence: 0.5,
        }),
      ];
    },
  },
  {
    id: "typography.too-many-families",
    category: "typography",
    kind: "heuristic",
    severity: "minor",
    description: "The page mixes several font families.",
    detect(snapshot) {
      const families = new Set();
      for (const el of elementsOf(snapshot)) {
        if (!el.text || !el.styles || !el.styles.fontFamily) continue;
        families.add(String(el.styles.fontFamily).split(",")[0].replace(/["']/g, "").trim().toLowerCase());
      }
      if (families.size < 4) return [];
      return [
        issue(null, {
          element: "text",
          selector: "body",
          message: "Too many font families",
          expected: "one or two families",
          actual: [...families].join(", "),
          confidence: 0.45,
        }),
      ];
    },
  },
];
