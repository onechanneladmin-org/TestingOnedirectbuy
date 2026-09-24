const { contrastRatio, elementsOf, isLargeText, issue, px } = require("./support");

module.exports = [
  {
    id: "a11y.contrast",
    category: "accessibility",
    kind: "deterministic",
    severity: "major",
    description: "Text contrast is below WCAG AA and still high enough to be visible.",
    detect(snapshot, ctx = {}) {
      const limits = ctx.options?.exceptions?.contrast || {};
      const normal = limits.normal ?? 4.5;
      const large = limits.large ?? 3;
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (!el.text || el.text.length < 2 || el.disabled) continue;
        if (!el.foreground || !el.background) continue;
        if (el.foreground.a != null && el.foreground.a < 0.2) continue;
        const ratio = contrastRatio(el.foreground, el.background);
        if (ratio == null || ratio < 1.3) continue;
        const min = isLargeText(px(el.styles && el.styles.fontSize), el.styles && el.styles.fontWeight)
          ? large
          : normal;
        if (ratio >= min) continue;
        findings.push(
          issue(el, {
            message: "Text contrast is below WCAG AA",
            expected: `>= ${min}:1`,
            actual: `${ratio.toFixed(2)}:1`,
          }),
        );
        if (findings.length >= 12) break;
      }
      return findings;
    },
  },
  {
    id: "a11y.image-missing-alt",
    category: "accessibility",
    kind: "deterministic",
    severity: "major",
    description: "An image is missing the alt attribute. Empty alt is allowed for decorative images.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => el.tag === "img" && el.altPresent === false && el.role !== "presentation")
        .slice(0, 12)
        .map((el) =>
          issue(el, {
            message: "Image is missing alt",
            expected: "alt text, or alt=\"\" when decorative",
            actual: "attribute absent",
          }),
        );
    },
  },
  {
    id: "a11y.document-language",
    category: "accessibility",
    kind: "deterministic",
    severity: "major",
    description: "html has no lang attribute.",
    detect(snapshot) {
      if (snapshot.htmlLang) return [];
      return [
        issue(null, {
          element: "document",
          selector: "html",
          message: "Document has no language",
          expected: "html lang attribute",
          actual: "empty",
        }),
      ];
    },
  },
  {
    id: "a11y.heading-skip",
    category: "accessibility",
    kind: "deterministic",
    severity: "minor",
    description: "Heading levels skip a rank or the page starts below h1.",
    detect(snapshot) {
      const headings = snapshot.headings || [];
      if (!headings.length) return [];
      const findings = [];
      if (headings[0].level > 1) {
        findings.push(
          issue(null, {
            element: `heading "${headings[0].text || ""}"`,
            selector: headings[0].selector,
            message: "First heading is not h1",
            expected: "h1",
            actual: `h${headings[0].level}`,
          }),
        );
      }
      for (let i = 1; i < headings.length; i += 1) {
        if (headings[i].level > headings[i - 1].level + 1) {
          findings.push(
            issue(null, {
              element: `heading "${headings[i].text || ""}"`,
              selector: headings[i].selector,
              message: "Heading level skips a rank",
              expected: `h${headings[i - 1].level + 1} or shallower after h${headings[i - 1].level}`,
              actual: `h${headings[i].level}`,
            }),
          );
        }
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "a11y.duplicate-id",
    category: "accessibility",
    kind: "deterministic",
    severity: "major",
    description: "The same id is used more than once.",
    detect(snapshot) {
      return (snapshot.duplicateIds || []).map((entry) =>
        issue(null, {
          element: `id "${entry.id}"`,
          selector: `[id="${entry.id}"]`,
          message: "Duplicate id",
          expected: "unique id",
          actual: `"${entry.id}" appears ${entry.count} times`,
        }),
      );
    },
  },
  {
    id: "a11y.positive-tabindex",
    category: "accessibility",
    kind: "deterministic",
    severity: "minor",
    description: "tabindex greater than 0 overrides the natural tab order.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => Number(el.tabindex) > 0)
        .slice(0, 8)
        .map((el) =>
          issue(el, {
            message: "Positive tabindex",
            expected: "tabindex 0 or omitted",
            actual: String(el.tabindex),
          }),
        );
    },
  },
  {
    id: "a11y.missing-main",
    category: "accessibility",
    kind: "heuristic",
    severity: "minor",
    description: "The page has no main landmark.",
    detect(snapshot) {
      if (snapshot.main) return [];
      return [
        issue(null, {
          element: "document",
          selector: "body",
          message: "No main landmark",
          expected: "main or role=main",
          actual: "absent",
          confidence: 0.6,
        }),
      ];
    },
  },
];
